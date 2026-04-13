import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { MailService } from "src/common/services/mail.service";
import { generateOTP, hashOTP, generateExpiry } from "./otp.util";
import { SendOtpDto } from "./dto/send-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";

@Injectable()
export class OtpService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const { phone, email, purpose } = dto;

    if (!phone && !email) {
      throw new BadRequestException("Phone or email required");
    }

    const identifier = phone || email;

    // Prevent spam 
    const recentOtp = await this.prisma.oTP.findFirst({
      where: {
        OR: [{ phone }, { email }],
        purpose,
        createdAt: {
          gt: new Date(Date.now() - 60 * 1000),
        },
      },
    });

    if (recentOtp) {
      throw new BadRequestException("OTP recently sent. Try again later.");
    }

    const code = generateOTP();

    await this.prisma.oTP.create({
      data: {
        phone,
        email,
        purpose,
        codeHash: hashOTP(code),
        expiresAt: generateExpiry(5),
      },
    });

    // Send OTP via email if email is provided
    if (email) {
      try {
        await this.mailService.sendOtp(
          email,
          code,
          purpose === "REGISTER" ? "registration" : purpose.toLowerCase(),
        );
      } catch (error) {
        // If email fails, log the code in console as fallback
        console.log(`OTP for ${identifier}: ${code}`);
      }
    } else {
      // TODO: Integrate SMS provider for phone OTP
      console.log(`OTP for ${identifier}: ${code}`);
    }

    return { message: "OTP sent successfully" };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const { identifier, code, purpose } = dto;

    const record = await this.prisma.oTP.findFirst({
      where: {
        OR: [{ phone: identifier }, { email: identifier }],
        purpose,
        verified: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      throw new BadRequestException("Invalid OTP request");
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException("OTP expired");
    }

    if (record.attempts >= 3) {
      throw new BadRequestException("Too many attempts");
    }

    const isValid = hashOTP(code) === record.codeHash;

    await this.prisma.oTP.update({
      where: { id: record.id },
      data: {
        attempts: { increment: 1 },
        verified: isValid ? true : false,
      },
    });

    if (!isValid) {
      throw new BadRequestException("Invalid OTP");
    }

    return { message: "OTP verified successfully" };
  }
}
