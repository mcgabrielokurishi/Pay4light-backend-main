import { IsString, IsNumber, IsNotEmpty, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export enum TvProvider {
  DSTV       = 'DSTV',
  GOTV       = 'GOTV',
  STARTIMES  = 'STARTIMES',
}

export class VendTvDto {
  @IsString()
  @IsNotEmpty()
  meter: string; // decoder number

  @IsString()
  @IsNotEmpty()
  disco: TvProvider;

  @IsString()
  @IsNotEmpty()
  tariffClass: string; // bouquet code from price list

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