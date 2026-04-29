
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { NotificationType } from '@prisma/client';
import { CreateNotificationDto } from './dto/create-notificattion.dto';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  // CREATE — called internally by other services
  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId:   dto.userId,
        title:    dto.title,
        message:  dto.message,
        type:     dto.type ?? NotificationType.INFO,
        metadata: dto.metadata ?? {},
      },
    });
  }

  // Convenience methods — called from other services
  async notifyTransaction(userId: string, message: string, metadata?: any) {
    return this.create({
      userId,
      title:    'Transaction Update',
      message,
      type:     NotificationType.TRANSACTION,
      metadata,
    });
  }

  async notifyElectricity(userId: string, message: string, metadata?: any) {
    return this.create({
      userId,
      title:    'Electricity Purchase',
      message,
      type:     NotificationType.ELECTRICITY,
      metadata,
    });
  }

  async notifySystem(userId: string, title: string, message: string) {
    return this.create({
      userId,
      title,
      message,
      type: NotificationType.SYSTEM,
    });
  }

  // GET USER NOTIFICATIONS
  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: notifications,
      unreadCount,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
      },
    };
  }

  // MARK ONE AS READ
  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data:  { isRead: true },
    });
  }

  // MARK ALL AS READ
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true },
    });
  }

  // DELETE ONE
  async deleteNotification(notificationId: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  // GET UNREAD COUNT
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  }
}