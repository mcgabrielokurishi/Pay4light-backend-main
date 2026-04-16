import { IsString, IsEnum } from "class-validator";
import { OtpPurpose } from "./send-otp.dto";

export class VerifyOtpDto {
  @IsString()
  identifier: string; // phone or email

  @IsString()
  code: string;

  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}