// src/vending/dto/vend-electricity-link.dto.ts
import {
  IsString, IsNumber, IsNotEmpty,
  IsEnum, IsPositive, IsOptional, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { VendType, DiscoCode } from './vend-electricity.dto';

export class VendElectricityLinkDto {
  @ApiProperty({
    description: 'Meter number for electricity purchase',
    example: '123456789',
  })
  @IsString()
  @IsNotEmpty()
  meter: string;

  @ApiProperty({
    description: 'Distribution company code',
    enum: DiscoCode,
    example: DiscoCode.ILEDC,
  })
  @IsEnum(DiscoCode)
  disco: DiscoCode;

  @ApiProperty({
    description: 'Type of vending transaction',
    enum: VendType,
    example: VendType.PREPAID,
  })
  @IsEnum(VendType)
  vendType: VendType;

  @ApiProperty({
    description: 'Amount to charge in Naira (minimum 100)',
    example: 5000,
    minimum: 100,
  })
  @IsNumber()
  @IsPositive()
  @Min(100)
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Phone number for the transaction',
    example: '08012345678',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Email address for the transaction (optional)',
    example: 'user@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Full name of the customer (optional)',
    example: 'John Doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Callback URL for payment redirect (optional)',
    example: 'https://example.com/payment-callback',
    required: false,
  })
  @IsString()
  @IsOptional()
  callbackUrl?: string; // where to redirect after payment
}