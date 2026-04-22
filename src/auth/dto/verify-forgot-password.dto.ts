import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyForgotPasswordDto {

  @ApiProperty({
    description : "Email",
    example : "mcgabrielokurishi@gmail.com"
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description : "OTP",
    example : "123456"
  })
  @IsString()
  @IsNotEmpty()
  otp: string;
}