// src/auth/dto/reset-password.dto.ts
import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
   @ApiProperty({
    description : "resetToken",
    example : "the token give in the verify-forgot-password"
  })
  @IsString()
  @IsNotEmpty()
  resetToken: string; // ← returned from verify step

   @ApiProperty({
    description : "Password",
    example : "P@ssw0rd"
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message: 'Password must contain at least one uppercase letter, one number, and one symbol',
  })
  newPassword: string;
}