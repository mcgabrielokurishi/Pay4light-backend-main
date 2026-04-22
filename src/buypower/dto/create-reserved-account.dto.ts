import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from 'class-validator';

export class CreateReservedAccountDto {
  @ApiProperty({ example: "user-uuid-123" })
  @IsString()
  reference: string;

  @ApiProperty({ example: "John Doe" })
  @IsString()
  name: string;

  @ApiProperty({ example: "john@gmail.com" })
  @IsEmail()
  email: string;
}