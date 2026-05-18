// src/admin/dto/admin.dto.ts
import {
  IsString, IsOptional, IsEnum,
  IsNumber, IsPositive, IsBoolean,
  IsEmail, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum UserFilterStatus {
  ALL        = 'ALL',
  ACTIVE     = 'ACTIVE',
  INACTIVE   = 'INACTIVE',
  VERIFIED   = 'VERIFIED',
  UNVERIFIED = 'UNVERIFIED',
  DELETED    = 'DELETED',
}

export class GetUsersDto {
  @IsOptional()
  @IsString()
  search?: string; // search by name, email, phone

  @IsOptional()
  @IsEnum(UserFilterStatus)
  status?: UserFilterStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class UpdateUserRoleDto {
  @IsEnum(['USER', 'ADMIN'])
  role: 'USER' | 'ADMIN';
}

export class AdjustWalletDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @IsEnum(['CREDIT', 'DEBIT'])
  type: 'CREDIT' | 'DEBIT';

  @IsString()
  @IsOptional()
  reason?: string;
}

export class BroadcastDto {
  @IsString()
  title: string;

  @IsString()
  message: string;
}

export class LockWalletDto {
  @IsBoolean()
  locked: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}