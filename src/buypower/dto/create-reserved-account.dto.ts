import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateReservedAccountDto {
  @IsString()
  @IsNotEmpty()
  reference: string; // Unique per user — use user UUID

  @IsString()
  @IsNotEmpty()
  name: string; // User full name

  @IsEmail()
  @IsNotEmpty()
  email: string;
}
