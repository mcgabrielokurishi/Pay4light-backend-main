// src/notification-settings/notification-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { MailService } from 'src/common/services/mail.service';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { NotificationService } from 'src/notification/notification.service';
import { UpdateNotificationSettingsDto } from './dto/update-setings.dto';

export type NotificationCategory =
  | 'transactions'
  | 'electricity'
  | 'security'
  | 'promotions'
  | 'lowBalance';

export interface NotificationPayload {
  userId:   string;
  title:    string;
  message:  string;
  category: NotificationCategory;
  metadata?: Record<string, any>;
  emailHtml?: string; // custom email HTML — if not provided, uses message
}

@Injectable()
export class NotificationManagerService {
  private readonly logger = new Logger(NotificationManagerService.name);

  constructor(
    private readonly prisma:       PrismaService,
    private readonly mailService:  MailService,
    private readonly push:         PushNotificationService,
    private readonly inApp:        NotificationService,
  ) {}

  // ─── GET OR CREATE SETTINGS ──────────────────────────────────────
  async getSettings(userId: string) {
    let settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    // Auto-create with defaults if not exists
    if (!settings) {
      settings = await this.prisma.notificationSettings.create({
        data: { userId },
      });
    }

    return settings;
  }

  // ─── UPDATE SETTINGS ─────────────────────────────────────────────
  async updateSettings(userId: string, dto: UpdateNotificationSettingsDto) {
    const settings = await this.prisma.notificationSettings.upsert({
      where:  { userId },
      update: dto,
      create: { userId, ...dto },
    });
    return settings;
  }

  // ─── SEND NOTIFICATION (respects settings) ───────────────────────
  async send(payload: NotificationPayload) {
    const settings = await this.getSettings(payload.userId);
    const cat      = payload.category;

    const promises: Promise<any>[] = [];

    // ─── IN-APP ──────────────────────────────────────────────────
    const inAppCatKey = `inApp${this.capitalize(cat)}` as keyof typeof settings;
    const inAppOk     =
      settings.inAppEnabled &&
      (settings[inAppCatKey] as boolean) !== false;

    if (inAppOk) {
      promises.push(
        this.inApp.create({
          userId:   payload.userId,
          title:    payload.title,
          message:  payload.message,
          type:     this.categoryToType(cat),
          metadata: payload.metadata,
        }).catch((err) =>
          this.logger.error(`In-app notification failed: ${err.message}`),
        ),
      );
    }

    // ─── PUSH ────────────────────────────────────────────────────
    const pushCatKey = `push${this.capitalize(cat)}` as keyof typeof settings;
    const pushOk     =
      settings.pushEnabled &&
      (settings[pushCatKey] as boolean) !== false;

    if (pushOk) {
      promises.push(
        this.push.sendToUser(
          payload.userId,
          payload.title,
          payload.message,
          payload.metadata
            ? Object.fromEntries(
                Object.entries(payload.metadata).map(([k, v]) => [k, String(v)]),
              )
            : undefined,
        ).catch((err) =>
          this.logger.error(`Push notification failed: ${err.message}`),
        ),
      );
    }

    // ─── EMAIL ───────────────────────────────────────────────────
    const emailCatKey = `email${this.capitalize(cat)}` as keyof typeof settings;
    const emailOk     =
      settings.emailEnabled &&
      (settings[emailCatKey] as boolean) !== false;

    if (emailOk) {
      // Get user email
      const user = await this.prisma.user.findUnique({
        where:  { id: payload.userId },
        select: { email: true, fullName: true, firstName: true },
      });

      if (user?.email) {
        const html = payload.emailHtml || this.buildDefaultEmailHtml(
          payload.title,
          payload.message,
          user.fullName || user.firstName || 'User',
        );

        promises.push(
          this.mailService.sendEmail(
            user.email,
            payload.title,
            html,
          ).catch((err) =>
            this.logger.error(`Email notification failed: ${err.message}`),
          ),
        );
      }
    }

    await Promise.allSettled(promises);
  }

  // ─── CONVENIENCE METHODS ─────────────────────────────────────────

  async notifyPasswordChanged(userId: string) {
    return this.send({
      userId,
      title:    ' Password Changed',
      message:  'Your Pay4Light password was changed successfully. If this was not you, contact support immediately.',
      category: 'security',
      metadata: { type: 'PASSWORD_CHANGE' },
      emailHtml: this.buildSecurityEmailHtml(
        'Password Changed',
        'Your Pay4Light account password was changed successfully.',
        'If you did not make this change, please contact our support team immediately and secure your account.',
      ),
    });
  }

  async notifyWalletCredited(userId: string, amount: number, reference?: string) {
    return this.send({
      userId,
      title:    ' Wallet Credited',
      message:  `₦${amount.toLocaleString()} has been added to your Pay4Light wallet.`,
      category: 'transactions',
      metadata: { type: 'WALLET_CREDIT', amount: String(amount), reference },
      emailHtml: this.buildTransactionEmailHtml(
        'Wallet Credited',
        amount,
        'CREDIT',
        reference,
      ),
    });
  }

  async notifyWalletDebited(userId: string, amount: number, reference?: string) {
    return this.send({
      userId,
      title:    ' Wallet Debited',
      message:  `₦${amount.toLocaleString()} has been deducted from your wallet.`,
      category: 'transactions',
      metadata: { type: 'WALLET_DEBIT', amount: String(amount), reference },
      emailHtml: this.buildTransactionEmailHtml(
        'Wallet Debited',
        amount,
        'DEBIT',
        reference,
      ),
    });
  }

  async notifyElectricityPurchased(
    userId:  string,
    token:   string,
    units:   string,
    amount:  number,
    meterId: string,
  ) {
    return this.send({
      userId,
      title:    ' Electricity Token Ready',
      message:  `Token: ${token} | ${units} kWh purchased for meter ${meterId}`,
      category: 'electricity',
      metadata: { type: 'ELECTRICITY', token, units, amount: String(amount), meterId },
      emailHtml: this.buildElectricityEmailHtml(token, units, amount, meterId),
    });
  }

  async notifyLowBalance(userId: string, balance: number) {
    return this.send({
      userId,
      title:    ' Low Wallet Balance',
      message:  `Your balance is ₦${balance.toLocaleString()}. Top up to avoid interruption.`,
      category: 'lowBalance',
      metadata: { type: 'LOW_BALANCE', balance: String(balance) },
    });
  }

  async notifyTokenExpiringSoon(
    userId:       string,
    daysLeft:     number,
    meterNumber:  string,
  ) {
    return this.send({
      userId,
      title:    'Electricity Running Low',
      message:  `Meter ${meterNumber} may run out in ${daysLeft} day(s). Buy units now.`,
      category: 'electricity',
      metadata: { type: 'TOKEN_EXPIRY', daysLeft: String(daysLeft), meterNumber },
    });
  }

  // ─── EMAIL HTML BUILDERS ─────────────────────────────────────────

  private buildDefaultEmailHtml(
    title:   string,
    message: string,
    name:    string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px;">
        <h2 style="color:#1a1a1a;">${title}</h2>
        <p style="color:#333;">Hi ${name},</p>
        <p style="color:#333;">${message}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#999;font-size:12px;">Pay4Light — Powering Nigeria</p>
      </div>
    `;
  }

  private buildSecurityEmailHtml(
    title:   string,
    main:    string,
    warning: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px;">
        <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:16px;margin-bottom:20px;">
          <h2 style="color:#856404;margin:0;"> ${title}</h2>
        </div>
        <p style="color:#333;">${main}</p>
        <div style="background:#f8d7da;border:1px solid #f5c6cb;border-radius:6px;padding:12px;margin:16px 0;">
          <p style="color:#721c24;margin:0;font-size:14px;"> ${warning}</p>
        </div>
        <p style="color:#333;">Time: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#999;font-size:12px;">Pay4Light — If you did not perform this action, contact support immediately.</p>
      </div>
    `;
  }

  private buildTransactionEmailHtml(
    title:     string,
    amount:    number,
    type:      'CREDIT' | 'DEBIT',
    reference?: string,
  ): string {
    const color = type === 'CREDIT' ? '#28a745' : '#dc3545';
    const sign  = type === 'CREDIT' ? '+' : '-';

    return `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px;">
        <h2 style="color:#1a1a1a;">${title}</h2>
        <div style="background:#f8f9fa;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
          <p style="font-size:32px;font-weight:bold;color:${color};margin:0;">${sign}₦${amount.toLocaleString()}</p>
          <p style="color:#666;font-size:14px;margin:8px 0 0;">Pay4Light Wallet</p>
        </div>
        ${reference ? `<p style="color:#666;font-size:13px;">Reference: ${reference}</p>` : ''}
        <p style="color:#666;font-size:13px;">Date: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#999;font-size:12px;">Pay4Light — Powering Nigeria</p>
      </div>
    `;
  }

  private buildElectricityEmailHtml(
    token:   string,
    units:   string,
    amount:  number,
    meterId: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px;">
        <h2 style="color:#1a1a1a;"> Electricity Token Ready</h2>
        <div style="background:#e8f5e9;border:1px solid #4caf50;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
          <p style="color:#666;font-size:13px;margin:0 0 8px;">Your Token</p>
          <p style="font-size:24px;font-weight:bold;color:#2e7d32;letter-spacing:4px;margin:0;">${token}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#666;">Units</td>
            <td style="padding:8px 0;text-align:right;font-weight:bold;">${units} kWh</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;">Amount Paid</td>
            <td style="padding:8px 0;text-align:right;font-weight:bold;">₦${amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;">Meter</td>
            <td style="padding:8px 0;text-align:right;">${meterId}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;">Date</td>
            <td style="padding:8px 0;text-align:right;">${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#999;font-size:12px;">Pay4Light — Powering Nigeria</p>
      </div>
    `;
  }

  // ─── HELPERS ─────────────────────────────────────────────────────
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private categoryToType(cat: NotificationCategory): any {
    const map: Record<NotificationCategory, string> = {
      transactions: 'TRANSACTION',
      electricity:  'ELECTRICITY',
      security:     'WARNING',
      promotions:   'INFO',
      lowBalance:   'WARNING',
    };
    return map[cat] ?? 'INFO';
  }
}