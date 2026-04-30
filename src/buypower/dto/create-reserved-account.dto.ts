import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateReservedAccountDto {
  @ApiProperty({
    description: 'Unique reference for the reserved account',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  reference: string;

  @ApiProperty({
    description: 'Name of the reserved account holder (company or individual)',
    example: 'Acme Corporation',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Bank Verification Number (required if NIN is not provided)',
    example: '12345678901',
  })
  @IsString()
  bvn?: string;

  @ApiPropertyOptional({
    description: 'National Identification Number (required if BVN is not provided)',
    example: '98765432109',
  })
  @IsString()
  nin?: string;

  @ApiProperty({
    description: 'Description of the reserved account purpose',
    example: 'Reserved account for electricity payments',
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}
