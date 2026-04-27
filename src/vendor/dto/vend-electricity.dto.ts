import {
  IsString, IsNumber, IsNotEmpty,
  IsOptional, IsEnum, IsPositive, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsString()
  @IsNotEmpty()
  meter: string;

  @IsEnum(DiscoCode)
  disco: DiscoCode;

  @IsEnum(VendType)
  vendType: VendType;

  @IsNumber()
  @IsPositive()
  @Min(100, { message: 'Minimum vend amount is ₦100' })
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