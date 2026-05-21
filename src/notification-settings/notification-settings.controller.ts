// src/notification-settings/notification-settings.controller.ts
import {
  Controller, Get, Patch,
  Body, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationManagerService } from './notification-manager.service';
import { UpdateNotificationSettingsDto } from './dto/update-setings.dto';

@Controller('notification-settings')
@UseGuards(AuthGuard('jwt'))
export class NotificationSettingsController {
  constructor(
    private readonly manager: NotificationManagerService,
  ) {}

  // GET current settings
  @Get()
  async getSettings(@Req() req: any) {
    const data = await this.manager.getSettings(req.user.id);
    return { success: true, data };
  }

  // UPDATE settings (partial — only send what you want to change)
  @Patch()
  async updateSettings(
    @Req() req: any,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    const data = await this.manager.updateSettings(req.user.id, dto);
    return {
      success: true,
      message: 'Notification settings updated',
      data,
    };
  }
}