// src/webhook/webhook.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from 'database/prisma.service';
import { WalletService } from 'src/wallet/wallet.service';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
  ) {}

  // ✅ Verify BuyPower webhook signature
  verifyBuyPowerSignature(signature: string, rawBody: string): boolean {
    const secret = process.env.BUYPOWER_WEBHOOK_SECRET;

    if (!secret) {
      this.logger.error('BUYPOWER_WEBHOOK_SECRET not set');
      return false;
    }

    if (!signature) {
      this.logger.warn('No signature provided — skipping in dev');
      // ✅ In development, skip signature check
      return process.env.NODE_ENV !== 'production';
    }

    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return hash === signature;
  }

  // ✅ Route BuyPower events
  async handleBuyPowerEvent(event: any) {
    this.logger.log(`BuyPower event type: ${event?.event || event?.type}`);
    this.logger.log('Full event:', JSON.stringify(event, null, 2));

    const eventType = event?.event || event?.type;

    switch (eventType) {
      case 'collection.successful':
      case 'account.credited':
      case 'transfer.credit':
        return this.handleWalletFunding(event);

      case 'transfer.debit':
      case 'vend.successful':
        return this.handleVendSuccess(event);

      default:
        this.logger.warn(`Unhandled BuyPower event: ${eventType}`);
        return { received: true };
    }
  }

  // ✅ Handle wallet funding — user sent money to virtual account
  private async handleWalletFunding(event: any) {
    // BuyPower sends different structures — handle all
    const data      = event?.data || event;
    const amount    = data?.amount    || data?.value;
    const nuban     = data?.nuban     || data?.accountNumber || data?.account_number;
    const reference = data?.reference || data?.sessionId     || data?.session_id || data?.id?.toString();

    this.logger.log(`Wallet funding event — nuban: ${nuban}, amount: ${amount}, ref: ${reference}`);

    if (!amount || !nuban) {
      this.logger.error('Missing amount or nuban in webhook', data);
      return { received: true, error: 'Missing required fields' };
    }

    // Find user by NUBAN
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        OR: [
          { virtualAccountNuban: nuban },
          { virtual_account_ref: reference },
        ],
      },
      include: { user: true },
    });

    if (!wallet) {
      this.logger.warn(`No wallet found for NUBAN: ${nuban}`);
      return { received: true, error: 'Wallet not found' };
    }

    const userId = wallet.userId;

    // ✅ Credit wallet — idempotent via reference
    const result = await this.walletService.creditFromWebhook(
      userId,
      Number(amount),
      reference,
      {
        description: `Wallet funded via BuyPower MFB — ₦${amount}`,
        metadata: { nuban, amount, reference, event },
      },
    );

    if (result.duplicated) {
      this.logger.warn(`Duplicate webhook ignored — ref: ${reference}`);
      return { received: true, duplicated: true };
    }

    // ✅ Send notification to user
    await this.notificationService.notifyTransaction(
      userId,
      `💰 Your wallet has been credited with ₦${Number(amount).toLocaleString()}`,
      { amount, reference, nuban },
    );

    this.logger.log(
      `Wallet credited — userId: ${userId}, amount: ₦${amount}, ref: ${reference}`,
    );

    return { received: true, success: true };
  }

  // ✅ Handle successful vend from webhook
  private async handleVendSuccess(event: any) {
    const data      = event?.data || event;
    const reference = data?.reference || data?.orderId || data?.order_id;
    const token     = data?.token;

    if (!reference) {
      this.logger.warn('No reference in vend webhook');
      return { received: true };
    }

    // Update vendor transaction
    const vendorTx = await this.prisma.vendorTransaction.findFirst({
      where: { reference },
    });

    if (!vendorTx) {
      this.logger.warn(`VendorTransaction not found for ref: ${reference}`);
      return { received: true };
    }

    if (vendorTx.status === 'SUCCESS') {
      this.logger.warn(`Duplicate vend webhook ignored — ref: ${reference}`);
      return { received: true, duplicated: true };
    }

    await this.prisma.vendorTransaction.update({
      where: { reference },
      data: {
        status: 'SUCCESS',
        token:  token,
        responsePayload: data,
      },
    });

    // Notify user
    if (token) {
      await this.notificationService.notifyElectricity(
        vendorTx.userId,
        `⚡ Electricity token ready: ${token}`,
        { token, reference },
      );
    }

    this.logger.log(`Vend webhook processed — ref: ${reference}, token: ${token}`);
    return { received: true, success: true };
  }
}