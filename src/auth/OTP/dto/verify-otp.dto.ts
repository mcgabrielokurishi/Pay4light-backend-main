import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { OtpPurpose } from "./send-otp.dto";

export class VerifyOtpDto {
  @ApiProperty({
    description: "Identifier can be a phone number or email address",
    example: "user@example.com",
  })
  @IsString()
  identifier: string;

  @ApiProperty({
    description: "The OTP code sent to the user",
    example: "123456",
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: "Purpose for OTP",
    example: "REGISTER",
  })
  @IsString()
  purpose: OtpPurpose; // <-- you need this line
}
