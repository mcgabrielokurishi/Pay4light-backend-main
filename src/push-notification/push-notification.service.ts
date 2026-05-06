// src/push-notification/push-notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { FirebaseService } from './firebase.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  // ─── REGISTER DEVICE TOKEN ──────────────────────────────────────
  async registerDeviceToken(
    userId:   string,
    token:    string,
    platform: 'ANDROID' | 'IOS' | 'WEB' = 'ANDROID',
  ) {
    await this.prisma.deviceToken.upsert({
      where:  { token },
      update: { userId, platform, isActive: true },
      create: { userId, token, platform },
    });

    this.logger.log(`Device token registered — userId: ${userId}`);
    return { success: true, message: 'Device token registered' };
  }

  // ─── REMOVE DEVICE TOKEN (logout) ───────────────────────────────
  async removeDeviceToken(userId: string, token: string) {
    await this.prisma.deviceToken.updateMany({
      where: { userId, token },
      data:  { isActive: false },
    });
    return { success: true, message: 'Device token removed' };
  }

  // ─── SEND TO ONE USER ────────────────────────────────────────────
  async sendToUser(
    userId:  string,
    title:   string,
    body:    string,
    data?:   Record<string, string>,
    type?:   NotificationType,
  ) {
    // Get all active device tokens for this user
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
    });

    if (!devices.length) {
      this.logger.warn(`No active devices for user ${userId}`);
      return { sent: false, reason: 'No active devices' };
    }

    const tokens = devices.map((d) => d.token);

    // Send push
    const result = await this.firebase.sendToMultipleDevices(
      tokens,
      title,
      body,
      data,
    );

    // Save to push notification log
    await this.prisma.pushNotification.create({
      data: {
        userId,
        title,
        body,
        data:   data ?? {},
        type:   type ?? NotificationType.INFO,
        status: result ? 'SENT' : 'FAILED',
        sentAt: new Date(),
      },
    });

    // Clean up invalid tokens
    if (result?.responses) {
      const invalidTokens: string[] = [];
      result.responses.forEach((resp, idx) => {
        if (
          !resp.success &&
          (resp.error?.code === 'messaging/invalid-registration-token' ||
           resp.error?.code === 'messaging/registration-token-not-registered')
        ) {
          invalidTokens.push(tokens[idx]);
        }
      });

      if (invalidTokens.length) {
        await this.prisma.deviceToken.updateMany({
          where: { token: { in: invalidTokens } },
          data:  { isActive: false },
        });
        this.logger.warn(`Deactivated ${invalidTokens.length} invalid tokens`);
      }
    }

    return {
      sent:         true,
      successCount: result?.successCount ?? 0,
      failureCount: result?.failureCount ?? 0,
    };
  }

  // ─── CONVENIENCE METHODS (called from other services) ───────────

  async notifyWalletCredited(userId: string, amount: number) {
    return this.sendToUser(
      userId,
      '💰 Wallet Credited',
      `₦${amount.toLocaleString()} has been added to your Pay4Light wallet`,
      { type: 'WALLET_CREDIT', amount: amount.toString() },
      NotificationType.TRANSACTION,
    );
  }

  async notifyWalletDebited(userId: string, amount: number) {
    return this.sendToUser(
      userId,
      '💸 Wallet Debited',
      `₦${amount.toLocaleString()} has been deducted from your wallet`,
      { type: 'WALLET_DEBIT', amount: amount.toString() },
      NotificationType.TRANSACTION,
    );
  }

  async notifyElectricityPurchased(
    userId: string,
    token:  string,
    units:  string,
    amount: number,
  ) {
    return this.sendToUser(
      userId,
      '⚡ Electricity Token Ready',
      `Your token: ${token} | ${units} kWh purchased`,
      { type: 'ELECTRICITY', token, units, amount: amount.toString() },
      NotificationType.ELECTRICITY,
    );
  }

  async notifyLowBalance(userId: string, balance: number) {
    return this.sendToUser(
      userId,
      '⚠️ Low Wallet Balance',
      `Your balance is ₦${balance.toLocaleString()}. Top up to avoid service interruption.`,
      { type: 'LOW_BALANCE', balance: balance.toString() },
      NotificationType.WARNING,
    );
  }

  async notifyTokenExpiringSoon(userId: string, daysLeft: number, meterId: string) {
    return this.sendToUser(
      userId,
      '🔋 Electricity Running Low',
      `Your meter ${meterId} may run out in ${daysLeft} day(s). Buy units now.`,
      { type: 'TOKEN_EXPIRY', daysLeft: daysLeft.toString(), meterId },
      NotificationType.WARNING,
    );
  }

  async notifyPasswordChanged(userId: string) {
    return this.sendToUser(
      userId,
      '🔐 Password Changed',
      'Your Pay4Light password was changed. If this was not you, contact support immediately.',
      { type: 'SECURITY' },
      NotificationType.WARNING,
    );
  }

  // ─── BROADCAST TO ALL USERS (admin) ─────────────────────────────
  async broadcastToAll(title: string, body: string, data?: Record<string, string>) {
    return this.firebase.sendToTopic('all-users', title, body, data);
  }

  // ─── GET PUSH HISTORY FOR USER ───────────────────────────────────
  async getPushHistory(userId: string, page = 1, limit = 20) {
    const [notifications, total] = await Promise.all([
      this.prisma.pushNotification.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      this.prisma.pushNotification.count({ where: { userId } }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages:  Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
      },
    };
  }
}