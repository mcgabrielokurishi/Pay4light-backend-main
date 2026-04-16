import { IsOptional, IsPhoneNumber, IsEmail, IsEnum, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export enum OtpPurpose {
  REGISTER = 'REGISTER',
  LOGIN = 'LOGIN',
  RESET_PASSWORD = 'RESET_PASSWORD',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
}

export class SendOtpDto {
  @ApiProperty({ required: false, example: "+2347012345678" })
  @IsOptional()
  @IsPhoneNumber("NG")
  phone?: string;

  @ApiProperty({ required: false, example: "user@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ enum: OtpPurpose, example: OtpPurpose.REGISTER })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
