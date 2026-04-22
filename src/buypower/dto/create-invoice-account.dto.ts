import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { isString,IsEmail,IsString,IsNumber} from "class-validator";

export class CreateInvoiceAccountDto {
  @ApiProperty({ example: "user-uuid-123", description: "Unique reference per user" })
  @IsString()
  reference!: string;

  @ApiProperty({ example: "John Doe" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "john@gmail.com" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "Invoice for electricity" })
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "2026-05-01T00:00:00Z" })
  @IsString()
  expiresAt?: string;

  @ApiProperty({ example: 5000, description: "Amount in Naira" })
  @IsNumber()
  amount!: number;
}