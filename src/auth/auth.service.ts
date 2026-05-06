import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { OtpService } from "./OTP/otp.service";
import { OtpPurpose } from "./OTP/dto/send-otp.dto";
import { PushNotificationService } from "src/push-notification/push-notification.service";
import { hashOTP } from "./OTP/otp.util";
import { ForgotPasswordDto } from "./dto/forgotten-password.dto";
import { VerifyForgotPasswordDto } from "./dto/verify-forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { randomUUID } from "crypto";
import { WalletService } from "src/wallet/wallet.service";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private MAX_FAILED_ATTEMPTS = 5;
  private LOCK_TIME_MINUTES = 15;
  

  // Temporary in-memory store for pending registrations
  private pendingRegistrations = new Map<string, {
    fullName: string;
    email?: string;
    phone?: string;
    hashedPassword: string;
    expiresAt: Date;
  }>();

  // Temporary in-memory store for verified reset tokens
  private resetTokens = new Map<string, {
    userId: string;
    email: string;
    expiresAt: Date;
  }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpService: OtpService,
     private walletService: WalletService,
     private push : PushNotificationService,
  ) {}

  // ─── REGISTER ───────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    if (!dto) throw new BadRequestException("Request body is missing");

    const { fullName, email, phone, password } = dto;

    if (!email && !phone) {
      throw new BadRequestException("Email or phone is required");
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (existingUser) throw new ConflictException("User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    const identifier = email || phone!;
    this.pendingRegistrations.set(identifier, {
      fullName,
      email,
      phone,
      hashedPassword,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await this.otpService.sendOtp({
      email,
      phone,
      purpose: OtpPurpose.REGISTER,
    });

    return {
      message: "OTP sent to your email/phone. Please verify to complete registration.",
      identifier,
    };
  }

  // COMPLETE REGISTRATION 

  async completeRegistration(identifier: string) {
    const otpRecord = await this.prisma.oTP.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
        purpose: OtpPurpose.REGISTER,
        verified: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      throw new UnauthorizedException("OTP not verified. Please verify OTP first.");
    }

    const pending = this.pendingRegistrations.get(identifier);

    if (!pending) {
      throw new BadRequestException(
        "Registration session expired. Please register again."
      );
    }

    if (pending.expiresAt < new Date()) {
      this.pendingRegistrations.delete(identifier);
      throw new BadRequestException(
        "Registration session expired. Please register again."
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
    if (existingUser) throw new ConflictException("User already exists");

     const newUser = await this.prisma.$transaction(async (db) => {
    const createdUser = await db.user.create({
      data: {
        fullName:   pending.fullName,
        email:      pending.email,
        phone:      pending.phone,
        password:   pending.hashedPassword,
        isVerified: true,
      },
    });

    await db.wallet.create({
      data: { userId: createdUser.id, balance: 0 },
    });

    return createdUser;
  });

  this.pendingRegistrations.delete(identifier);

  // ✅ Provision virtual account in background — don't block registration
  this.provisionAccountAfterRegistration(newUser).catch((err) => {
    this.logger.warn(
      `Virtual account provisioning failed for user ${newUser.id}: ${err.message}`,
    );
  });

    this.pendingRegistrations.delete(identifier);

    return this.generateTokens(newUser.id, newUser.email ?? newUser.phone!);
    
  }
  private async provisionAccountAfterRegistration(user: {
  id:       string;
  fullName: string | null;
  email:    string | null;
  phone:    string | null;
}) {
  try {
    const firstName =
      user.fullName?.split(' ')[0] ??
      user.email?.split('@')[0] ??
      'Pay4Light';

    const lastName =
      user.fullName?.split(' ').slice(1).join(' ') ??
      'User';

    await this.walletService.provisionVirtualAccount({
      id: user.id,
      firstName,
      lastName,
      email: user.email ?? '',
    });

    this.logger.log(`Virtual account provisioned for user ${user.id}`);
  } catch (error) {
    this.logger.error(
      `Failed to provision virtual account for user ${user.id}`,
      error,
    );
  }
}


  // ─── LOGIN 

  async login(dto: LoginDto) {
    const { identifier, password } = dto;

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });

    if (!user) throw new UnauthorizedException("Invalid credentials");

    if (!user.isVerified) {
      throw new UnauthorizedException("Please verify your account first");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException("Account locked. Try again later.");
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      await this.handleFailedLogin(user.id);
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    return this.generateTokens(user.id, user.email ?? user.phone!);
  }

  // ─── FORGOT PASSWORD 

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;

    const user = await this.prisma.user.findFirst({ where: { email } });

    // Always return same message — prevents email enumeration attacks
    if (!user) {
      return {
        message: 'If an account with that email exists, an OTP has been sent.',
      };
    }

    if (!user.isVerified) {
      throw new BadRequestException(
        'Account not verified. Please verify your account first.',
      );
    }

    await this.otpService.sendOtp({
      email,
      purpose: OtpPurpose.RESET_PASSWORD,
    });

    return {
      message: 'OTP sent to your email.',
      identifier: email,
    };
  }

  // ─── VERIFY FORGOT PASSWORD 

  async verifyForgotPasswordOtp(dto: VerifyForgotPasswordDto) {
    const { email, otp } = dto;

    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user) throw new BadRequestException('Invalid request');

    // Find OTP record
    const otpRecord = await this.prisma.oTP.findFirst({
      where: {
        OR: [{ email }, { phone: email }],
        purpose: OtpPurpose.RESET_PASSWORD,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Validate OTP code
    const isValidOtp = hashOTP(otp) === otpRecord.codeHash;
    if (!isValidOtp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Mark OTP as verified
    await this.prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    // Generate reset token — valid for 10 minutes
    const resetToken = randomUUID();

    this.resetTokens.set(resetToken, {
      userId: user.id,
      email: user.email!,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    return {
      verified: true,
      message: 'OTP verified. Proceed to reset your password.',
      resetToken,
    };
  }

  // ─── RESET PASSWORD — 

  async resetPassword(dto: ResetPasswordDto) {
    const { resetToken, newPassword } = dto;

    // Validate reset token
    const tokenData = this.resetTokens.get(resetToken);

    if (!tokenData) {
      throw new BadRequestException(
        'Invalid or expired reset token. Please start the process again.',
      );
    }

    if (tokenData.expiresAt < new Date()) {
      this.resetTokens.delete(resetToken);
      throw new BadRequestException(
        'Reset token has expired. Please start the process again.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: tokenData.userId },
    });

    if (!user) throw new BadRequestException('User not found');

    // Check new password is not same as old
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password cannot be the same as your current password',
      );
    }

    // After password reset:
    await this.push.notifyPasswordChanged(user.id);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    // Clean up reset token
    this.resetTokens.delete(resetToken);

    return {
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    };
  }

  // ─── REFRESH ────────────────────────────────────────────────────

  async refresh(dto: RefreshDto) {
    const { refreshToken } = dto;

    try {
      const payload = await this.jwtService.verifyAsync(
        refreshToken.toString(),
        { secret: process.env.JWT_REFRESH_SECRET }
      ) as { sub: string; email: string };

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) throw new UnauthorizedException();

      return this.generateTokens(user.id, user.email ?? user.phone!);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  // ─── GENERATE TOKENS ────────────────────────────────────────────

  async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: "15m",
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: "7d",
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // ─── HANDLE FAILED LOGIN ─────────────────────────────────────────

  private async handleFailedLogin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const newAttempts = (user?.failedAttempts || 0) + 1;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedAttempts: newAttempts,
        lockedUntil: newAttempts >= this.MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + this.LOCK_TIME_MINUTES * 60 * 1000)
          : undefined,
      },
    });
  }
}