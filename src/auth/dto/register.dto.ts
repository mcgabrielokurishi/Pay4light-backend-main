import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({
    example: "mcgabriel Okurishi",
    description: "User full name",
  })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ required: false, example: "mcgabrielokurishi@gmail.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: "+2347012345678" })
  @IsOptional()
  @IsPhoneNumber("NG")
  phone?: string;

  @ApiProperty({ example: "P@ssw0rd1" })
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/, {
    message:
      "Password must contain at least one uppercase letter, one number, and one symbol",
  })
  password: string;

  // @ApiProperty({ example: "123456" })
  // @IsString()
  // otp: string;
}
