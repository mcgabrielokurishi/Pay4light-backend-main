import { Controller, Post, Body } from "@nestjs/common";
import { OtpService } from "./otp.service";
import { SendOtpDto } from "./dto/send-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";

@Controller("otp")
export class OtpController {
  constructor(private otpService: OtpService) {}

  @Post("send")
  send(@Body() dto: SendOtpDto) {
    return this.otpService.sendOtp(dto);
  }

  @Post("verify")
  verify(@Body() dto: VerifyOtpDto) {
    return this.otpService.verifyOtp(dto);
  }
}