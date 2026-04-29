// src/buypower/dto/create-reserved-account.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReservedAccountDto {
  @ApiProperty({
    description: 'External reference for the reserved account',
    example: 'REF123456',
  })
  @IsString()
  @IsNotEmpty()
  exRef: string;

  @ApiProperty({
    description: 'Name of the reserved account holder',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the reserved account',
    example: 'Reserved account for electricity payments',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  ser
  // NIN is hardcoded in the service
  @ApiPropertyOptional({
    description: 'Bank Verification Number (optional)',
    example: '12345678901',
  })
  @IsString()
  @IsOptional()
  bvn?: string;
}
