import { IsOptional, IsPhoneNumber, IsEmail, IsEnum } from "class-validator";
import { OtpPurpose } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";

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
