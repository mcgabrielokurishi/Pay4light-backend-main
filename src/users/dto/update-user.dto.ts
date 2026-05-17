import {
  IsOptional,
  IsString,
  IsEnum,
  IsEmail,
} from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export enum MeterType {
  PREPAID = "PREPAID",
  POSTPAID = "POSTPAID",
}

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: "John",
    description: "User first name",
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    example: "Doe",
    description: "User last name",
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    example: "John Doe",
    description: "Full name of the user",
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    enum: MeterType,
    example: MeterType.PREPAID,
    description: "Meter type",
  })
  @IsOptional()
  @IsEnum(MeterType)
  meterType?: MeterType;

  @ApiPropertyOptional({
    example: "12345678901",
    description: "Electricity meter number",
  })
  @IsOptional()
  @IsString()
  meterNumber?: string;

  @ApiPropertyOptional({
    example: "johndoe@gmail.com",
    description: "User email address",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: "08123456789",
    description: "Phone number",
  })
  @IsOptional()
  @IsString()
  phone?: string;
}