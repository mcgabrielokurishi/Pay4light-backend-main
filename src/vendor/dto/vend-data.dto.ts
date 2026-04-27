import { IsString, IsNumber, IsNotEmpty, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export enum DataProvider {
  MTN      = 'MTN',
  AIRTEL   = 'AIRTEL',
  GLO      = 'GLO',
  ETISALAT = '9MOBILE',
}

export class VendDataDto {
  @IsString()
  @IsNotEmpty()
  meter: string; // phone number to vend data for

  @IsString()
  @IsNotEmpty()
  disco: DataProvider;

  @IsString()
  @IsNotEmpty()
  tariffClass: string; // data plan code from price list

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;
}