import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {

  @ApiProperty({
    description:"email",
    example:"mcgabrielokurishi@gmail.com"
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
