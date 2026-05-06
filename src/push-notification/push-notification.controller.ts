// src/push-notification/push-notification.controller.ts
import {
  Controller, Post, Delete, Get,
  Body, Query, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PushNotificationService } from './push-notification.service';
import { IsString, IsEnum, IsOptional } from 'class-validator';

class RegisterTokenDto {
  @IsString()
  token: string;

  @IsEnum(['ANDROID', 'IOS', 'WEB'])
  @IsOptional()
  platform?: 'ANDROID' | 'IOS' | 'WEB';
}

class RemoveTokenDto {
  @IsString()
  token: string;
}

@Controller('push')
@UseGuards(AuthGuard('jwt'))
export class PushNotificationController {
  constructor(
    private readonly pushService: PushNotificationService,
  ) {}

  // Register device token — call this on app launch / login
  @Post('register-token')
  async registerToken(@Req() req: any, @Body() dto: RegisterTokenDto) {
    return this.pushService.registerDeviceToken(
      req.user.id,
      dto.token,
      dto.platform ?? 'ANDROID',
    );
  }

  // Remove device token — call this on logout
  @Delete('remove-token')
  async removeToken(@Req() req: any, @Body() dto: RemoveTokenDto) {
    return this.pushService.removeDeviceToken(req.user.id, dto.token);
  }

  // Get push notification history
  @Get('history')
  async getHistory(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.pushService.getPushHistory(
      req.user.id,
      Number(page),
      Number(limit),
    );
  }

  // Test push — send yourself a test notification
  @Post('test')
  async testPush(@Req() req: any) {
    return this.pushService.sendToUser(
      req.user.id,
      '🎉 Test Notification',
      'Your Pay4Light push notifications are working correctly!',
      { type: 'TEST' },
    );
  }
}