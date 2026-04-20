import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { OtpService } from "./OTP/otp.service";
import { OtpPurpose } from "./OTP/dto/send-otp.dto";
import { hashOTP } from "./OTP/otp.util";
import { ForgotPasswordDto } from "./dto/forgotten-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Injectable()
export class AuthService {
  private MAX_FAILED_ATTEMPTS = 5;
  private LOCK_TIME_MINUTES = 15;

  //  Temporary in-memory store for pending registrations
  // Holds user data between register() and completeRegistration()
  private pendingRegistrations = new Map<string, {
    fullName: string;
    email?: string;
    phone?: string;
    hashedPassword: string;
    expiresAt: Date;
  }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpService: OtpService,
  ) {}

  // STEP 1 — REGISTER (just send OTP, save nothing to DB)
  async register(dto: RegisterDto) {
    if (!dto) throw new BadRequestException("Request body is missing");

    const { fullName, email, phone, password } = dto;

    if (!email && !phone) {
      throw new BadRequestException("Email or phone is required");
    }

    // Check if user already exists in DB
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (existingUser) throw new ConflictException("User already exists");

    //  Hash password but DO NOT save user to DB yet
    const hashedPassword = await bcrypt.hash(password, 10);

    //  Store temporarily in memory with 10 minute expiry
    const identifier = email || phone!;
    this.pendingRegistrations.set(identifier, {
      fullName,
      email,
      phone,
      hashedPassword,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Send OTP
    await this.otpService.sendOtp({
      email,
      phone,
      purpose: OtpPurpose.REGISTER,
    });

    console.log("otp", this.otpService.sendOtp)

    return {
      message: "OTP sent to your email/phone. Please verify to complete registration.",
      identifier,
    };
  }

  // COMPLETE REGISTRATION (only NOW save user to DB)
  async completeRegistration(identifier: string) {
    //  Check OTP was verified first
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

    //  Retrieve pending registration data from memory
    const pending = this.pendingRegistrations.get(identifier);

    if (!pending) {
      throw new BadRequestException(
        "Registration session expired. Please register again."
      );
    }

    // Check if session has expired (10 minutes)
    if (pending.expiresAt < new Date()) {
      this.pendingRegistrations.delete(identifier);
      throw new BadRequestException(
        "Registration session expired. Please register again."
      );
    }

    //  Double check user still doesn't exist
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
    if (existingUser) throw new ConflictException("User already exists");
 
    // NOW create the user + wallet in DB
    const newUser = await this.prisma.$transaction(async (db) => {
      const createdUser = await db.user.create({
        data: {
          fullName: pending.fullName,
          email: pending.email,
          phone: pending.phone,
          password: pending.hashedPassword,
          isVerified: true, //  already verified via OTP
        },
      });

      await db.wallet.create({
        data: { userId: createdUser.id, balance: 0 },
      });

      return createdUser;
    });
  
    //  Clean up pending registration from memory
    this.pendingRegistrations.delete(identifier);

    // Return tokens
    return this.generateTokens(newUser.id, newUser.email ?? newUser.phone!);
  }

  // LOGIN
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

  async forgotPassword(dto: ForgotPasswordDto) {
  const { email } = dto;

  // Check user exists
  const user = await this.prisma.user.findFirst({
    where: { email },
  });

  // Always return same message — prevents email enumeration attacks
  if (!user) {
    return {
      message: 'If an account with that email exists, an OTP has been sent.',
    };
  }

  if (!user.isVerified) {
    throw new BadRequestException('Account not verified. Please verify your account first.');
  }

  // Send OTP
  await this.otpService.sendOtp({
    email,
    purpose: OtpPurpose.RESET_PASSWORD,
  });

  return {
    message: 'If an account with that email exists, an OTP has been sent.',
    identifier: email,
  };
}

// RESET PASSWORD 
async resetPassword(dto: ResetPasswordDto) {
  const { email, otp, newPassword } = dto;

  // Find user
  const user = await this.prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    throw new BadRequestException('Invalid request');
  }

  // Verify OTP
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

  const isValidOtp = hashOTP(otp) === otpRecord.codeHash;
  if (!isValidOtp) {
    throw new BadRequestException('Invalid or expired OTP');
  }

  // Check new password is not same as old
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new BadRequestException('New password cannot be the same as your current password');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password + mark OTP as verified
  await this.prisma.$transaction([
    this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        failedAttempts: 0,      
        lockedUntil: null,     
      },
    }),
    this.prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    }),
  ]);

  return {
    message: 'Password reset successfully. Please log in with your new password.',
  };
}


  // REFRESH
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

  // GENERATE TOKENS
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

  // HANDLE FAILED LOGIN
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
