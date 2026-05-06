// src/payment/payment.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { WalletService } from 'src/wallet/wallet.service';
import { NotificationService } from 'src/notification/notification.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { randomUUID } from 'crypto';
import axios from 'axios';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly paystackBase = 'https://api.paystack.co';
  private readonly secretKey    = process.env.PAYSTACK_SECRET_KEY;

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  constructor(
    private readonly prisma:              PrismaService,
    private readonly walletService:       WalletService,
    private readonly notificationService: NotificationService,
  ) {}

  // ─── STEP 1: INITIALIZE PAYMENT ─────────────────────────────────
  // User wants to add money — create a Paystack payment link
  async initializePayment(userId: string, dto: InitializePaymentDto) {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true, fullName: true, firstName: true, lastName: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.email) throw new BadRequestException('Email required for payment');

    const reference = `PAY4L-${randomUUID()}`;
    const amountInKobo = dto.amount * 100; // Paystack uses kobo

    const wallet = await this.prisma.wallet.findFirst({
      where:  { userId },
      select: { id: true },
    });

    if (!wallet) throw new NotFoundException('Wallet not found');

    // Save pending transaction
    await this.prisma.transaction.create({
      data: {
        userId,
        walletId:    wallet.id,
        type:        'WALLET_CREDIT',
        amount:      dto.amount,
        status:      'PENDING',
        reference,
        description: `Wallet funding via Paystack — ₦${dto.amount}`,
        metadata:    JSON.stringify({ gateway: 'paystack', amountInKobo }),
      },
    });

    // Call Paystack initialize
    const response = await axios.post(
      `${this.paystackBase}/transaction/initialize`,
      {
        email:        user.email,
        amount:       amountInKobo,
        reference,
        callback_url: dto.callbackUrl || process.env.PAYSTACK_CALLBACK_URL,
        metadata: {
          userId,
          fullName: user.fullName || `${user.firstName} ${user.lastName}`,
          custom_fields: [
            {
              display_name: 'Purpose',
              variable_name: 'purpose',
              value: 'Wallet Funding',
            },
          ],
        },
      },
      { headers: this.headers },
    );

    const data = response.data;

    if (!data.status) {
      throw new BadRequestException(data.message || 'Failed to initialize payment');
    }

    this.logger.log(`Payment initialized — ref: ${reference}, amount: ₦${dto.amount}`);

    return {
      success:       true,
      message:       'Payment initialized successfully',
      reference,
      amount:        dto.amount,
      paymentUrl:    data.data.authorization_url, // ← redirect user here
      accessCode:    data.data.access_code,
    };
  }

  // ─── STEP 2: VERIFY PAYMENT ──────────────────────────────────────
  // Called after user returns from Paystack page
  async verifyPayment(reference: string, userId: string) {
    const response = await axios.get(
      `${this.paystackBase}/transaction/verify/${reference}`,
      { headers: this.headers },
    );

    const data = response.data?.data;

    if (!data || data.status !== 'success') {
      throw new BadRequestException('Payment not successful');
    }

    // Check it belongs to this user
    const tx = await this.prisma.transaction.findUnique({
      where: { reference },
    });

    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.userId !== userId) throw new BadRequestException('Unauthorized');
    if (tx.status === 'SUCCESS') {
      return { success: true, message: 'Already processed', alreadyCredited: true };
    }

    const amount = data.amount / 100; // convert kobo back to naira

    // Credit wallet
    await this.walletService.creditFromWebhook(
      userId,
      amount,
      reference,
      { description: `Wallet funded via card — ₦${amount}` },
    );

    // Save card for future use if authorization exists
    if (data.authorization?.reusable) {
      await this.saveCard(userId, data.authorization, data.customer);
    }

    // Notify user
    await this.notificationService.notifyTransaction(
      userId,
      `💳 ₦${amount.toLocaleString()} added to your wallet via card`,
      { reference, amount },
    );

    return {
      success:  true,
      message:  'Wallet credited successfully',
      amount,
      reference,
    };
  }

  // ─── SAVE CARD ───────────────────────────────────────────────────
  private async saveCard(userId: string, authorization: any, customer: any) {
    const existing = await this.prisma.savedCard.findFirst({
      where: {
        userId,
        authorizationCode: authorization.authorization_code,
      },
    });

    if (existing) return; // card already saved

    await this.prisma.savedCard.create({
      data: {
        userId,
        authorizationCode: authorization.authorization_code,
        cardType:          authorization.card_type,
        last4:             authorization.last4,
        expMonth:          authorization.exp_month,
        expYear:           authorization.exp_year,
        bank:              authorization.bank,
        brand:             authorization.brand,
        email:             customer.email,
      },
    });

    this.logger.log(`Card saved for user ${userId} — ${authorization.last4}`);
  }

  // ─── GET SAVED CARDS ─────────────────────────────────────────────
  async getSavedCards(userId: string) {
    const cards = await this.prisma.savedCard.findMany({
      where:   { userId, isActive: true },
      select: {
        id:        true,
        cardType:  true,
        last4:     true,
        expMonth:  true,
        expYear:   true,
        bank:      true,
        brand:     true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: cards };
  }

  // ─── CHARGE SAVED CARD ───────────────────────────────────────────
  async chargeCard(userId: string, cardId: string, amount: number) {
    const card = await this.prisma.savedCard.findFirst({
      where: { id: cardId, userId, isActive: true },
    });

    if (!card) throw new NotFoundException('Card not found');

    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true },
    });

    if (!user?.email) throw new BadRequestException('User email required');

    const reference    = `PAY4L-${randomUUID()}`;
    const amountInKobo = amount * 100;

    const wallet = await this.prisma.wallet.findFirst({
      where:  { userId },
      select: { id: true },
    });

    if (!wallet) throw new NotFoundException('Wallet not found');

    // Save pending transaction
    await this.prisma.transaction.create({
      data: {
        userId,
        walletId:    wallet.id,
        type:        'WALLET_CREDIT',
        amount,
        status:      'PENDING',
        reference,
        description: `Wallet funding via saved card — ₦${amount}`,
        metadata:    JSON.stringify({ gateway: 'paystack', cardId }),
      },
    });

    // Charge the saved card
    const response = await axios.post(
      `${this.paystackBase}/transaction/charge_authorization`,
      {
        email:              user.email,
        amount:             amountInKobo,
        authorization_code: card.authorizationCode,
        reference,
        metadata: {
          userId,
          purpose: 'Wallet Funding',
        },
      },
      { headers: this.headers },
    );

    const data = response.data?.data;

    if (!data || data.status !== 'success') {
      // Update transaction as failed
      await this.prisma.transaction.update({
        where: { reference },
        data:  { status: 'FAILED' },
      });
      throw new BadRequestException(
        response.data?.message || 'Card charge failed',
      );
    }

    // Credit wallet immediately
    await this.walletService.creditFromWebhook(
      userId,
      amount,
      reference,
      { description: `Wallet funded via saved card — ₦${amount}` },
    );

    // Notify
    await this.notificationService.notifyTransaction(
      userId,
      `💳 ₦${amount.toLocaleString()} added to your wallet via saved card`,
      { reference, amount },
    );

    return {
      success:   true,
      message:   'Wallet credited successfully',
      amount,
      reference,
    };
  }

  // ─── DELETE SAVED CARD ───────────────────────────────────────────
  async deleteCard(userId: string, cardId: string) {
    const card = await this.prisma.savedCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) throw new NotFoundException('Card not found');

    await this.prisma.savedCard.update({
      where: { id: cardId },
      data:  { isActive: false },
    });

    return { success: true, message: 'Card removed successfully' };
  }

  // ─── HANDLE PAYSTACK WEBHOOK ─────────────────────────────────────
  async handlePaystackWebhook(event: any) {
    this.logger.log(`Paystack event: ${event.event}`);
    this.logger.log('Payload:', JSON.stringify(event, null, 2));

    switch (event.event) {
      case 'charge.success':
        return this.handleChargeSuccess(event.data);
      default:
        this.logger.warn(`Unhandled Paystack event: ${event.event}`);
        return { received: true };
    }
  }

  private async handleChargeSuccess(data: any) {
    const reference = data.reference;
    const amount    = data.amount / 100;

    const tx = await this.prisma.transaction.findUnique({
      where: { reference },
    });

    if (!tx) {
      this.logger.warn(`Transaction not found for ref: ${reference}`);
      return { received: true };
    }

    if (tx.status === 'SUCCESS') {
      this.logger.warn(`Duplicate webhook — ref: ${reference}`);
      return { received: true, duplicated: true };
    }

    await this.walletService.creditFromWebhook(
      tx.userId,
      amount,
      reference,
      { description: `Wallet funded via Paystack — ₦${amount}` },
    );

    // Save card if reusable
    if (data.authorization?.reusable) {
      await this.saveCard(tx.userId, data.authorization, data.customer);
    }

    await this.notificationService.notifyTransaction(
      tx.userId,
      `💰 ₦${amount.toLocaleString()} added to your wallet`,
      { reference, amount },
    );

    return { received: true, success: true };
  }
}