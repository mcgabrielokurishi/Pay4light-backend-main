// src/notification/notification.controller.ts
import {
  Controller, Get, Patch, Delete,
  Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // GET ALL NOTIFICATIONS
  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.notificationService.getUserNotifications(
      req.user.id,
      Number(page),
      Number(limit),
    );
    return {
      success: true,
      message: 'Notifications retrieved successfully',
      ...result,
    };
  }

  // GET UNREAD COUNT
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  // MARK ONE AS READ
  @Patch(':id/read')
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    await this.notificationService.markAsRead(id, req.user.id);
    return { success: true, message: 'Notification marked as read' };
  }

  // MARK ALL AS READ
  @Patch('read-all')
  async markAllAsRead(@Req() req: any) {
    await this.notificationService.markAllAsRead(req.user.id);
    return { success: true, message: 'All notifications marked as read' };
  }

  // DELETE
  @Delete(':id')
  async deleteNotification(@Req() req: any, @Param('id') id: string) {
    await this.notificationService.deleteNotification(id, req.user.id);
    return { success: true, message: 'Notification deleted' };
  }
}