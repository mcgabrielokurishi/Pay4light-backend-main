import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from 'database/prisma.service';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  verifySignature(signature: string, rawBody: string): boolean {
    const secret = process.env.BUYPOWER_WEBHOOK_SECRET;

    if (!secret) {
      this.logger.error('Webhook secret not configured');
      throw new Error('Missing webhook secret'); 
    }

    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return hash === signature;
  }

  verifySignaturePayment(signature: string, rawBody: string): boolean {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;

    if (!secret) {
      this.logger.error('Paystack webhook secret not configured');
      throw new Error('Missing Paystack webhook secret'); 
    }

    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return hash === signature;
  }

  async handleEvent(event: any) {
    this.logger.log(`Webhook received: ${event.type}`);

    switch (event.type) {
      case 'account.credited':
        return this.handleAccountCredited(event.data);

      case 'transfer.successful':
        return this.handleTransferSuccessful(event.data);

      default:
        this.logger.warn(`Unhandled event: ${event.type}`);
    }
  }

  private async handleAccountCredited(data: any) {
    const { reference, amount, userId } = data;

    if (!reference) throw new BadRequestException('Missing reference');

    const tx = await this.prisma.transaction.findUnique({
      where: { reference },
    });

    if (!tx) {
      this.logger.warn(`Transaction not found: ${reference}`);
      return;
    }

    if (tx.status === 'SUCCESS') {
      this.logger.warn(`Duplicate webhook ignored: ${reference}`);
      return;
    }


    await this.walletService.credit(
      userId,
      new Decimal(amount),
      'Webhook credit',
    );

    await this.prisma.transaction.update({
      where: { reference },
      data: { status: 'SUCCESS' },
    });

    this.logger.log(`Wallet credited for ${userId} → ${amount}`);
  }

  private async handleTransferSuccessful(data: any) {
    const { reference, token } = data;

    const tx = await this.prisma.transaction.findUnique({
      where: { reference },
    });

    if (!tx) {
      this.logger.warn(`Transaction not found: ${reference}`);
      return;
    }

    if (tx.status === 'SUCCESS') {
      this.logger.warn(`Duplicate webhook ignored: ${reference}`);
      return;
    }

    await this.prisma.transaction.update({
      where: { reference },
      data: {
        status: 'SUCCESS',
        metadata: {
          ...(tx.metadata as any),
          token,
        },
      },
    });

    this.logger.log(`Electricity token delivered: ${reference}`);
  }

  async handleChargeSuccess(data: any) {
    const reference = data.reference;
    const amount = new Decimal(data.amount).div(100); 

    this.logger.log(`Processing payment: ${reference}`);

    const tx = await this.prisma.transaction.findUnique({
      where: { reference },
    });

    if (!tx) {
      this.logger.warn(`Transaction not found: ${reference}`);
      return;
    }

    if (tx.status === 'SUCCESS') {
      this.logger.warn(`Duplicate webhook ignored: ${reference}`);
      return;
    }

    await this.prisma.transaction.update({
      where: { reference },
      data: {
        status: 'SUCCESS',
        metadata: {
          ...(tx.metadata as any),
          paystackResponse: data,
        },
      },
    });

    
    await this.walletService.credit(
      tx.userId,
      amount,
      'Wallet funding via Paystack',
    );

    this.logger.log(`Wallet credited for ${reference}`);
  }

  async handlePaystackEvent(event: any) {
    const { event: type, data } = event;

    switch (type) {
      case 'charge.success':
        return this.handleChargeSuccess(data);

      default:
        this.logger.warn(`Unhandled Paystack event: ${type}`);
        return;
    }
  }
}