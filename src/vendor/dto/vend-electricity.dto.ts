
import {
  IsString, IsNumber, IsNotEmpty,
  IsOptional, IsEnum, IsPositive, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum VendType {
  PREPAID = 'PREPAID',
  POSTPAID = 'POSTPAID',
}

export enum DiscoCode {
  ABUJA  = 'ABUJA',
  IKEJA  = 'IKEJA',
  EKO    = 'EKO',
  IBADAN = 'IBADAN',
  ENUGU  = 'ENUGU',
  KADUNA = 'KADUNA',
  JOS    = 'JOS',
  KANO   = 'KANO',
  BENIN  = 'BENIN',
  PHED   = 'PHED',
  YOLA   = 'YOLA',
}

export class VendElectricityDto {
  @ApiProperty({
    description: 'Electricity meter number',
    example: '12345678901',
  })
  @IsString()
  @IsNotEmpty()
  meter: string;

  @ApiProperty({
    description: 'Electricity distribution company',
    enum: DiscoCode,
    example: DiscoCode.IKEJA,
  })
  @IsEnum(DiscoCode)
  disco: DiscoCode;

  @ApiProperty({
    description: 'Type of electricity subscription',
    enum: VendType,
    example: VendType.PREPAID,
  })
  @IsEnum(VendType)
  vendType: VendType;

  @ApiProperty({
    description: 'Amount to vend (minimum ₦100)',
    example: 1000,
  })
  @IsNumber()
  @IsPositive()
  @Min(100, { message: 'Minimum vend amount is ₦100' })
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Customer phone number',
    example: '08012345678',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    description: 'Customer email address (optional)',
    example: 'user@example.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Customer full name (optional)',
    example: 'John Doe',
  })
  @IsString()
  @IsOptional()
  name?: string;
}