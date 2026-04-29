
import {
  IsString, IsNumber, IsNotEmpty,
  IsOptional, IsPositive
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TvProvider {
  DSTV       = 'DSTV',
  GOTV       = 'GOTV',
  STARTIMES  = 'STARTIMES',
}

export class VendTvDto {
  @ApiProperty({
    description: 'Decoder (smart card) number',
    example: '1234567890',
  })
  @IsString()
  @IsNotEmpty()
  meter: string;

  @ApiProperty({
    description: 'TV service provider',
    enum: TvProvider,
    example: TvProvider.DSTV,
  })
  @IsString()
  @IsNotEmpty()
  disco: TvProvider;

  @ApiProperty({
    description: 'Bouquet or subscription package code',
    example: 'DSTV_PREMIUM',
  })
  @IsString()
  @IsNotEmpty()
  tariffClass: string;

  @ApiProperty({
    description: 'Subscription amount in Naira',
    example: 5000,
  })
  @IsNumber()
  @IsPositive()
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
    description: 'Customer email (optional)',
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