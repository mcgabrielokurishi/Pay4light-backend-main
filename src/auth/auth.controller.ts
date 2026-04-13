import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { OtpService } from "./OTP/otp.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { VerifyOtpDto } from "./OTP/dto/verify-otp.dto";

@ApiTags('Auth')
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  
  // REGISTER
  
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // VERIFY OTP AND COMPLETE REGISTRATION
  @Post("register/verify-otp")
  @HttpCode(HttpStatus.OK)
  async verifyOtpAndRegister(
    @Body() dto: { identifier: string; code: string; password: string }
  ) {
    // Verify the OTP
    await this.otpService.verifyOtp({
      identifier: dto.identifier,
      code: dto.code,
      purpose: "REGISTER" as any,
    });

    // Complete registration and return tokens
    return this.authService.completeRegistration(dto.identifier);
  }

  
  // LOGIN
  
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  async refresh(@Body() dto: RefreshDto){
    return this.authService.refresh(dto)
  }
}
