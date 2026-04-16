import { IsString, IsEmail, IsNotEmpty, IsOptional, IsNumber } from "class-validator";

export class CreateInvoiceAccountDto {
  @IsString()
  @IsNotEmpty()
  reference!: string; // Unique per user — use user UUID

  @IsString()
  @IsNotEmpty()
  name!: string; // User full name

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsOptional()
  description?: string; // Description for the invoice

  @IsString()
  @IsOptional()
  expiresAt?: string; // Expiration date

  @IsNumber()
  @IsNotEmpty()
  amount!: number; // Amount in naira
}