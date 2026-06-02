import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  HttpCode,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import * as crypto from "crypto";
import { WalletService } from "../wallet/wallet.service";
import { NotificationService } from "src/notification/notification.service";

@Controller("webhooks")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
    private readonly notification:  NotificationService,
  ) {}

  @Post("buypower")
  @HttpCode(200)
  async handleBuypowerWebhook(
    @Req() req: Request,
    @Headers("x-payable-signature") signature: string, // ✅ correct header
    @Body() payload: any,
  ) {
    // ✅ Log everything
    this.logger.log('=== BUYPOWER WEBHOOK RECEIVED ===');
    this.logger.log(`Event: ${JSON.stringify(payload)}`);
    this.logger.log(`Signature: ${signature}`);
    this.logger.log('=================================');

    // ✅ Only verify signature in production AND when secret is set
    const webhookSecret = this.configService.get<string>('BUYPOWER_WEBHOOK_SECRET');
    const isProduction  = this.configService.get<string>('NODE_ENV') === 'production';

    if (isProduction && webhookSecret && signature) {
      const isValid = this.verifySignature(
        JSON.stringify(payload),
        signature,
        webhookSecret,
      );
      if (!isValid) {
        this.logger.warn('Invalid webhook signature');
        throw new BadRequestException('Invalid webhook signature');
      }
    } else {
      this.logger.log('Signature check skipped — dev mode or no secret');
    }

    // ✅ Extract event type
    const eventType: string = payload?.event ?? payload?.type ?? '';
    this.logger.log(`Event type: "${eventType}"`);

    // ✅ Check if it's a collection event by eventType (not status)
    if (!this.isCollectionEvent(eventType)) {
      this.logger.log(`Skipping non-collection event: "${eventType}"`);
      return { received: true };
    }

    // ✅ Extract data — handle all BuyPower payload structures
    const data = payload?.data ?? payload;

    const amount = Number(
      data?.amount ||
      data?.value  ||
      data?.Amount ||
      0,
    );

    const nuban =
      data?.nuban              ||
      data?.accountNumber      ||
      data?.account_number     ||
      data?.destinationAccount ||
      null;

    const externalRef =
      data?.reference      ||
      data?.transactionRef ||
      data?.exchangeRef    ||
      data?.sessionId      ||
      data?.session_id     ||
      data?.id?.toString() ||
      null;

    this.logger.log(`Parsed — nuban: ${nuban}, amount: ₦${amount}, ref: ${externalRef}`);

    // ✅ Validate required fields
    if (!amount || amount <= 0) {
      this.logger.error(`Invalid amount: ${amount}`);
      return { received: true, error: 'Invalid amount' };
    }

    // ✅ Find user by NUBAN
    const user = await this.walletService.findUserByNubanOrReference(
      nuban     || '',
      externalRef || nuban || '',
    );

    if (!user) {
      // ✅ Show all NUBANs in DB for debugging
      this.logger.warn(`No user found for nuban: "${nuban}" | ref: "${externalRef}"`);

      const allWallets = await this.walletService.getAllWalletNubans();
      this.logger.warn(`All NUBANs in DB: ${JSON.stringify(allWallets)}`);

      return { received: true, error: 'User not found' };
    }

    this.logger.log(`Found user: ${user.id}`);

    // ✅ Generate a unique reference if none provided
    const ref = externalRef || `bp-${nuban}-${Date.now()}`;

    // ✅ Credit wallet
    try {
      const result = await this.walletService.creditFromWebhook(
        user.id,
        amount,
        ref,
        {
          description: `Wallet funded via BuyPower MFB — ₦${amount.toLocaleString()}`,
          metadata: {
            nuban,
            amount,
            reference:         externalRef,
            sourceAccountName: data?.sourceAccountName,
            sourceAccount:     data?.sourceAccountNumber,
            narration:         data?.narration,
            event:             eventType,
          },
        },
      );

      if (result.duplicated) {
        this.logger.warn(`Duplicate webhook — ref: ${ref}`);
        return { received: true, duplicate: true };
      }

      // ✅ Send in-app notification
      await this.notification.create({
        userId:  user.id,
        title:   '💰 Wallet Funded',
        message: `₦${amount.toLocaleString()} has been added to your wallet successfully.`,
        type:    'TRANSACTION',
        metadata: { amount, nuban, reference: ref },
      });

      this.logger.log(`✅ Wallet credited — userId: ${user.id}, amount: ₦${amount}`);
      return { received: true, credited: true };

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to credit wallet: ${err.message}`);
      this.logger.error(err.stack);
      return { received: true, error: err.message };
    }
  }

  // ✅ Fixed — checks eventType not status
  private isCollectionEvent(eventType: string): boolean {
    const collectionEvents = [
      'collection.successfully',  // BuyPower uses this spelling
      'collection.successful',
      'collection.confirmed',
      'account.credited',
      'transfer.credit',
      'wallet.credit',
    ];

    const lower = eventType.toLowerCase();

    return (
      collectionEvents.includes(lower) ||
      lower.includes('collection')     ||
      lower.includes('credit')         ||
      lower.includes('fund')
    );
  }

  // ✅ Returns boolean instead of throwing
  private verifySignature(
    rawBody:    string,
    signature:  string,
    secret:     string,
  ): boolean {
    try {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const cleanSig = signature.replace('sha256=', '');

      const sigBuf = Buffer.from(cleanSig, 'hex');
      const expBuf = Buffer.from(expected, 'hex');

      if (sigBuf.length !== expBuf.length) return false;

      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }
}