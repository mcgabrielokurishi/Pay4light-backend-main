// src/notification/dto/create-notification.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { Type } from 'class-transformer';
import { NotificationMetadataDto } from './notification-metadata.dto';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'ID of the user receiving the notification',
    example: 'user_12345',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Title of the notification',
    example: 'Payment Successful',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Message body of the notification',
    example: 'Your electricity bill has been paid successfully.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.INFO,
  })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  // ✅ NEW FIELD
  @ApiPropertyOptional({
    description: 'Additional metadata for the notification',
    type: NotificationMetadataDto,
  })
  @ValidateNested()
  @Type(() => NotificationMetadataDto)
  @IsOptional()
  metadata?: NotificationMetadataDto;
}