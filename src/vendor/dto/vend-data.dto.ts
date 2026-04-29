import { IsString, IsNumber, IsNotEmpty, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DataProvider {
  MTN      = 'MTN',
  AIRTEL   = 'AIRTEL',
  GLO      = 'GLO',
  ETISALAT = '9MOBILE',
}

export class VendDataDto {
  @ApiProperty({
    description: 'Phone number to vend data for (recipient number)',
    example: '08012345678',
  })
  @IsString()
  @IsNotEmpty()
  meter: string;

  @ApiProperty({
    description: 'Mobile network provider',
    enum: DataProvider,
    example: DataProvider.MTN,
  })
  @IsString()
  @IsNotEmpty()
  disco: DataProvider;

  @ApiProperty({
    description: 'Data plan code from the provider price list',
    example: 'MTN_1GB_DAILY',
  })
  @IsString()
  @IsNotEmpty()
  tariffClass: string;

  @ApiProperty({
    description: 'Amount to be charged for the data plan (in Naira)',
    example: 1000,
  })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Customer phone number (for contact or receipt)',
    example: '08087654321',
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