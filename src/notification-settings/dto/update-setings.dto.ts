// src/notification-settings/dto/update-settings.dto.ts
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationSettingsDto {
  // Push
  @ApiProperty({ description: 'Enable push notifications', required: false, type: Boolean })
  @IsBoolean() @IsOptional() pushEnabled?: boolean;

  @ApiProperty({ description: 'Push notifications for transactions', required: false, type: Boolean })
  @IsBoolean() @IsOptional() pushTransactions?: boolean;

  @ApiProperty({ description: 'Push notifications for electricity', required: false, type: Boolean })
  @IsBoolean() @IsOptional() pushElectricity?: boolean;

  @ApiProperty({ description: 'Push notifications for security alerts', required: false, type: Boolean })
  @IsBoolean() @IsOptional() pushSecurity?: boolean;

  @ApiProperty({ description: 'Push notifications for promotions', required: false, type: Boolean })
  @IsBoolean() @IsOptional() pushPromotions?: boolean;

  @ApiProperty({ description: 'Push notifications for low balance', required: false, type: Boolean })
  @IsBoolean() @IsOptional() pushLowBalance?: boolean;

  // Email
  @ApiProperty({ description: 'Enable email notifications', required: false, type: Boolean })
  @IsBoolean() @IsOptional() emailEnabled?: boolean;

  @ApiProperty({ description: 'Email notifications for transactions', required: false, type: Boolean })
  @IsBoolean() @IsOptional() emailTransactions?: boolean;

  @ApiProperty({ description: 'Email notifications for electricity', required: false, type: Boolean })
  @IsBoolean() @IsOptional() emailElectricity?: boolean;

  @ApiProperty({ description: 'Email notifications for security alerts', required: false, type: Boolean })
  @IsBoolean() @IsOptional() emailSecurity?: boolean;

  @ApiProperty({ description: 'Email notifications for promotions', required: false, type: Boolean })
  @IsBoolean() @IsOptional() emailPromotions?: boolean;

  @ApiProperty({ description: 'Email notifications for low balance', required: false, type: Boolean })
  @IsBoolean() @IsOptional() emailLowBalance?: boolean;

  // In-app
  @ApiProperty({ description: 'Enable in-app notifications', required: false, type: Boolean })
  @IsBoolean() @IsOptional() inAppEnabled?: boolean;

  @ApiProperty({ description: 'In-app notifications for transactions', required: false, type: Boolean })
  @IsBoolean() @IsOptional() inAppTransactions?: boolean;

  @ApiProperty({ description: 'In-app notifications for electricity', required: false, type: Boolean })
  @IsBoolean() @IsOptional() inAppElectricity?: boolean;

  @ApiProperty({ description: 'In-app notifications for security alerts', required: false, type: Boolean })
  @IsBoolean() @IsOptional() inAppSecurity?: boolean;

  @ApiProperty({ description: 'In-app notifications for promotions', required: false, type: Boolean })
  @IsBoolean() @IsOptional() inAppPromotions?: boolean;

  @ApiProperty({ description: 'In-app notifications for low balance', required: false, type: Boolean })
  @IsBoolean() @IsOptional() inAppLowBalance?: boolean;
}
