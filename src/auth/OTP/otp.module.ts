import { Module } from "@nestjs/common";
import { OtpService } from "./otp.service";
import { OtpController } from "./otp.controller";
import { PrismaService } from "database/prisma.service";
import { MailService } from "src/common/services/mail.service";

@Module({
  providers: [OtpService, PrismaService, MailService],
  controllers: [OtpController],
  exports: [OtpService],
})
export class OtpModule {}
