// src/vending/vend-invoice.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { BuypowerMfbService } from 'src/buypower-mfb/buypower-mfb.service';
import { VendingService } from 'src/vendor/vendor.service';
import { NotificationService } from 'src/notification/notification.service';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { MailService } from 'src/common/services/mail.service';
import { getMeterRechargeEmail } from 'src/common/template/email.template';
import { VendElectricityLinkDto } from './dto/vend-electricity-link.dto';

@Injectable()
export class VendInvoiceService {
  private readonly logger         = new Logger(VendInvoiceService.name);
  private readonly SERVICE_CHARGE = 100;

  constructor(
    private readonly prisma:           PrismaService,
    private readonly config:           ConfigService,
    private readonly buypowerMfb:      BuypowerMfbService,
    private readonly vendingService:   VendingService,
    private readonly notification:     NotificationService,
    private readonly push:             PushNotificationService,
    private readonly mailService:      MailService,
  ) {}

  // ─── GENERATE INVOICE ACCOUNT ────────────────────────────────────
  async generateInvoice(userId: string, dto: VendElectricityLinkDto) {
    const reference   = `PL_${Date.now()}_${Math.floor(Math.random() * 99999999)}`;
    const totalAmount = dto.amount + this.SERVICE_CHARGE;

    // Get user info
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true, fullName: true, firstName: true, lastName: true },
    });

    const email = dto.email || user?.email;
    if (!email) throw new BadRequestException('Email is required');

    const name = dto.name || user?.fullName ||
      `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() ||
      'Pay4Light Customer';

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minute expiry

    // ✅ Call BuyPower MFB to create invoice account
    const invoiceResult = await this.buypowerMfb.createInvoiceAccount({
      reference,
      amount:      totalAmount,
      email,
      name,
      description: `Pay4Light electricity vend — Meter: ${dto.meter} | DISCO: ${dto.disco} | ₦${dto.amount} + ₦${this.SERVICE_CHARGE} service charge`,
      expiresAt:   expiresAt.toISOString(),
    });

    const accountNumber = invoiceResult?.data?.accountNumber || invoiceResult?.accountNumber;
    const bankName      = invoiceResult?.data?.bankName      || invoiceResult?.bankName || 'BuyPower MFB';

    if (!accountNumber) {
      this.logger.error('No account number in BuyPower response:', invoiceResult);
      throw new BadRequestException('Failed to create invoice account — please try again');
    }

    // ✅ Save invoice order
    await this.prisma.vendInvoice.create({
      data: {
        userId,
        reference,
        meter:         dto.meter,
        disco:         dto.disco,
        vendType:      dto.vendType,
        amount:        dto.amount,
        serviceCharge: this.SERVICE_CHARGE,
        totalAmount,
        phone:         dto.phone,
        email,
        name,
        status:        'PENDING',
        accountNumber,
        bankName,
        expiresAt,
      },
    });

    // ✅ Notify user
    await this.notification.create({
      userId,
      title:   '💡 Invoice Created — Pay to Vend',
      message: `Transfer ₦${totalAmount.toLocaleString()} to account ${accountNumber} (${bankName}) ` +
               `to purchase electricity for meter ${dto.meter}. Expires in 30 minutes.`,
      type:    'INFO',
    });

    this.logger.log(`Invoice created — ref: ${reference}, account: ${accountNumber}`);

    return {
      success:       true,
      message:       'Invoice account created. Transfer the exact amount to complete your purchase.',
      reference,
      meter:         dto.meter,
      disco:         dto.disco,
      amount:        dto.amount,
      serviceCharge: this.SERVICE_CHARGE,
      totalAmount,
      payment: {
        accountNumber,
        bankName,
        accountName:   name,
        amount:        totalAmount,
        narration:     `Pay4Light - ${reference}`,
      },
      expiresAt:     expiresAt.toISOString(),
      expiresIn:     '30 minutes',
      instructions:  [
        `Transfer exactly ₦${totalAmount.toLocaleString()} to the account above`,
        'Use any Nigerian bank app or USSD',
        'Your electricity token will be sent automatically after payment',
        'Do not transfer a different amount',
      ],
    };
  }

  // ─── HANDLE BUYPOWER WEBHOOK ─────────────────────────────────────
  async handleBuypowerWebhook(payload: any) {
    this.logger.log('=== BUYPOWER MFB WEBHOOK ===');
    this.logger.log(JSON.stringify(payload, null, 2));

    const transactionStatus = payload?.transactionStatus || '';
    const accountType       = payload?.bankAccountType   || '';

    // ✅ Only process confirmed invoice payments
    if (
      transactionStatus !== 'CONFIRMED' ||
      accountType !== 'Invoice'
    ) {
      this.logger.log(
        `Skipping — status: ${transactionStatus}, type: ${accountType}`,
      );
      return { received: true };
    }

    return this.processConfirmedPayment(payload);
  }

  private async processConfirmedPayment(payload: any) {
    const reference     = payload?.reference || payload?.transactionReference;
    const amount        = Number(payload?.amount || 0);
    const accountNumber = payload?.destinationAccountNumber;

    this.logger.log(
      `Processing confirmed payment — ref: ${reference}, account: ${accountNumber}, amount: ₦${amount}`,
    );

    // Find invoice by reference or account number
    let invoice = await this.prisma.vendInvoice.findFirst({
      where: {
        OR: [
          { reference },
          { accountNumber },
        ],
      },
    });

    if (!invoice) {
      this.logger.warn(`Invoice not found — ref: ${reference}, account: ${accountNumber}`);
      return { received: true, error: 'Invoice not found' };
    }

    if (invoice.status === 'SUCCESS') {
      this.logger.warn(`Duplicate webhook — ref: ${reference}`);
      return { received: true, duplicated: true };
    }

    if (invoice.status === 'VENDING') {
      this.logger.warn(`Already vending — ref: ${reference}`);
      return { received: true };
    }

    // ✅ Mark as vending to prevent duplicate processing
    await this.prisma.vendInvoice.update({
      where: { id: invoice.id },
      data:  { status: 'VENDING' },
    });

    // ✅ Vend electricity
    try {
      const vendResult = await this.vendingService.vendElectricity({
        userId:   invoice.userId,
        meter:    invoice.meter,
        disco:    invoice.disco as any,
        vendType: invoice.vendType as any,
        amount:   invoice.amount,
        phone:    invoice.phone,
        email:    invoice.email,
        name:     invoice.name || undefined,
        reference: `vend-${invoice.reference}`,
      });

      // ✅ Update invoice as success
      await this.prisma.vendInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'SUCCESS',
          token:  vendResult.token,
          units:  vendResult.units?.toString(),
        },
      });

      // Get user for notifications
      const user = await this.prisma.user.findUnique({
        where:  { id: invoice.userId },
        select: { email: true, firstName: true, fullName: true },
      });

      const firstName =
        user?.firstName ||
        user?.fullName?.split(' ')[0] ||
        'Customer';

      const now = new Date().toLocaleString('en-NG', {
        timeZone: 'Africa/Lagos',
        day:      'numeric',
        month:    'long',
        year:     'numeric',
        hour:     '2-digit',
        minute:   '2-digit',
      });

      // ✅ Send email receipt
      if (user?.email) {
        this.mailService.sendEmail(
          user.email,
          '⚡ Meter Recharged — Your Token is Ready',
          getMeterRechargeEmail({
            firstName,
            amount:        invoice.amount,
            units:         vendResult.units?.toString() || '0',
            meterNumber:   invoice.meter,
            token:         vendResult.token || '',
            disco:         invoice.disco,
            reference:     invoice.reference,
            date:          now,
            paymentMethod: 'Bank Transfer (Invoice)',
          }),
        ).catch((err) => this.logger.error(`Email failed: ${err.message}`));
      }

      // ✅ Push + in-app notifications
      await Promise.all([
        this.push.notifyElectricityPurchased(
          invoice.userId,
          vendResult.token || '',
          vendResult.units?.toString() || '0',
          invoice.amount,
        ),
        this.notification.create({
          userId:  invoice.userId,
          title:   '⚡ Electricity Token Ready!',
          message: `Payment received! Token: ${vendResult.token} | ${vendResult.units} kWh | Meter: ${invoice.meter}`,
          type:    'ELECTRICITY',
          metadata: {
            token:  vendResult.token,
            units:  vendResult.units,
            meter:  invoice.meter,
            reference: invoice.reference,
          },
        }),
      ]);

      this.logger.log(
        `✅ Vend success — ref: ${reference}, token: ${vendResult.token}`,
      );
      return { received: true, success: true };

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Vend failed after payment — ref: ${reference}:`,
        errMsg,
      );

      await this.prisma.vendInvoice.update({
        where: { id: invoice.id },
        data:  { status: 'FAILED' },
      });

      // ✅ Notify user — contact support
      await this.notification.create({
        userId:  invoice.userId,
        title:   '❌ Electricity Vending Failed',
        message: `Your payment of ₦${invoice.totalAmount.toLocaleString()} was received ` +
                 `but vending failed. Contact support with reference: ${reference}. ` +
                 `We will resolve this within 24 hours.`,
        type:    'WARNING',
      });

      return { received: true, error: errMsg };
    }
  }

  // ─── CHECK INVOICE STATUS ────────────────────────────────────────
  async checkInvoiceStatus(reference: string, userId: string) {
    const invoice = await this.prisma.vendInvoice.findFirst({
      where: { reference, userId },
    });

    if (!invoice) throw new BadRequestException('Invoice not found');

    const isExpired = invoice.expiresAt && new Date() > invoice.expiresAt;

    return {
      success:       true,
      reference:     invoice.reference,
      status:        invoice.status,
      meter:         invoice.meter,
      disco:         invoice.disco,
      amount:        invoice.amount,
      serviceCharge: invoice.serviceCharge,
      totalAmount:   invoice.totalAmount,
      payment: {
        accountNumber: invoice.accountNumber,
        bankName:      invoice.bankName,
        amount:        invoice.totalAmount,
      },
      token:         invoice.token,
      units:         invoice.units,
      expiresAt:     invoice.expiresAt,
      isExpired,
      message:
        invoice.status === 'SUCCESS'  ? `⚡ Token ready: ${invoice.token}` :
        invoice.status === 'VENDING'  ? '⏳ Payment received — vending in progress' :
        invoice.status === 'FAILED'   ? '❌ Vending failed — contact support' :
        isExpired                     ? '⏰ Invoice expired — create a new one' :
                                        '⏳ Awaiting payment',
    };
  }

  // ─── GET USER INVOICES ───────────────────────────────────────────
  async getUserInvoices(userId: string, page = 1, limit = 10) {
    const [invoices, total] = await Promise.all([
      this.prisma.vendInvoice.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      this.prisma.vendInvoice.count({ where: { userId } }),
    ]);

    return {
      success: true,
      data:    invoices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
} 