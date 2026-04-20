import { IsEmail, IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
 @ApiProperty({
    description:"email",
    example:"mcgabrielokurishi@gmail.com"
 })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: "OTP-CODE",
    example: "123456"
  })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({
    description : "PassW0rd",
    example : "P@ssW0rd"
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message: 'Password must contain at least one uppercase letter, one number, and one symbol',
  })
  newPassword: string;
}