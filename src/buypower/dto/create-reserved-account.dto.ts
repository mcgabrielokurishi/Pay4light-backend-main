import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum AccountType {
  STATIC = 'STATIC',
  DYNAMIC = 'DYNAMIC',
}

export class CreateReservedAccountDto {
  @ApiProperty({
    description : "refreence",
    example : ""
  })
  @IsString()
  @IsNotEmpty()
  exRef: string; 

  @ApiProperty({
    description: "name",
    example : "mcgabriel okurishi"
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description : "descprition",
    example : "Pay4Light wallet funding account"
  })
  @IsString()
  @IsNotEmpty()
  description: string; 

  @ApiProperty({
    description : "account type",
    example : "DYNAMIC"
  })
  @IsString()
  @IsNotEmpty()
  accountType: string; 

  @ApiProperty({
    description : "BVN",
    example : "3454555455"
  })
  @IsString()
  @IsOptional()
  bvn?: string; 

  @ApiProperty({
    description : "nin",
    example : "1234567890"
  })
  @IsString()
  @IsOptional()
  nin?: string;
}