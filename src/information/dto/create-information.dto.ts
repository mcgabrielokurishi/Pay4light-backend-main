
import {
  IsString, IsNotEmpty, IsEnum,
  IsOptional, IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InfoCategory } from '@prisma/client';

export class CreateInformationDto {
  @ApiProperty({
    description: 'Title of the information entry',
    example: 'Electricity Tariff Update',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Content body of the information entry',
    example: 'The new tariff rates will take effect from May 1st.',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Category of the information',
    enum: InfoCategory,
    example: InfoCategory.NEWS,
  })
  @IsEnum(InfoCategory)
  @IsOptional()
  category?: InfoCategory;

  @ApiPropertyOptional({
    description: 'Flag to indicate if the information is published',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class UpdateInformationDto {
  @ApiPropertyOptional({
    description: 'Updated title of the information entry',
    example: 'Electricity Tariff Revision',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated content body of the information entry',
    example: 'Tariff rates have been revised effective June 1st.',
  })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({
    description: 'Updated category of the information',
    enum: InfoCategory,
    example: InfoCategory.ALERT,
  })
  @IsEnum(InfoCategory)
  @IsOptional()
  category?: InfoCategory;

  @ApiPropertyOptional({
    description: 'Updated publication status',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
