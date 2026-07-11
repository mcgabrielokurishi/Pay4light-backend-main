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

  //  GENERATE INVOICE ACCOUNT 
  async generateInvoice(userId: string, dto: VendElectricityLinkDto) {
  const reference   = `PL_${Date.now()}_${Math.floor(Math.random() * 99999999)}`;
  const totalAmount = dto.amount + this.SERVICE_CHARGE;

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
  expiresAt.setMinutes(expiresAt.getMinutes() + 30);

  // Call BuyPower MFB
  const invoiceResult = await this.buypowerMfb.createInvoiceAccount({
    reference,
    amount:      totalAmount,
    email,
    name,
    description: `Pay4Light electricity vend — Meter: ${dto.meter} | DISCO: ${dto.disco} | ₦${dto.amount} + ₦${this.SERVICE_CHARGE} service charge`,
    expiresAt:   expiresAt.toISOString(),
  });

  console.log('Full invoice result:', JSON.stringify(invoiceResult, null, 2));

  // ✅ BuyPower returns 'nuban' not 'accountNumber'
  const accountNumber =
    invoiceResult?.data?.nuban        ||
    invoiceResult?.data?.accountNumber ||
    invoiceResult?.nuban               ||
    invoiceResult?.accountNumber       ||
    null;

  const bankName =
    invoiceResult?.data?.bankName ||
    invoiceResult?.bankName       ||
    'BuyPower MFB';

  if (!accountNumber) {
    this.logger.error('No account number in BuyPower response:', invoiceResult);
    throw new BadRequestException(
      'Failed to create invoice account — please try again',
    );
  }

  // Save invoice order
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

  // Notify user
  await this.notification.create({
    userId,
    title:   '💡 Invoice Created — Pay to Vend',
    message: `Transfer ₦${totalAmount.toLocaleString()} to account ${accountNumber} (${bankName}) ` +
             `to purchase electricity for meter ${dto.meter}. Expires in 30 minutes.`,
    type:    'INFO',
  });

  this.logger.log(`Invoice created — ref: ${reference}, nuban: ${accountNumber}`);

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
      accountName: name,
      amount:      totalAmount,
      narration:   `Pay4Light - ${reference}`,
    },
    expiresAt:    expiresAt.toISOString(),
    expiresIn:    '30 minutes',
    instructions: [
      `Transfer exactly ₦${totalAmount.toLocaleString()} to the account above`,
      'Use any Nigerian bank app or USSD',
      'Your electricity token will be sent automatically after payment',
      'Do not transfer a different amount',
    ],
  };
}

  // HANDLE BUYPOWER WEBHOOK 
  async handleBuypowerWebhook(payload: any) {
  this.logger.log('=== BUYPOWER MFB WEBHOOK ===');
  this.logger.log(JSON.stringify(payload, null, 2));

  const event         = payload?.event         || '';
  const data          = payload?.data          || {};
  const status        = data?.status           || '';
  const accountType   = data?.accountType      || '';

  this.logger.log(`Event: "${event}", Status: "${status}", AccountType: "${accountType}"`);

  //  BuyPower sends "invoice.paid" as the event
  if (
    event === 'invoice.paid' ||
    (status === 'CONFIRMED' && accountType === 'INVOICE')
  ) {
    return this.processConfirmedPayment(payload);
  }

  this.logger.log(`Skipping event: "${event}"`);
  return { received: true };
}

private async processConfirmedPayment(payload: any) {
  const data = payload?.data || {};

  //  BuyPower uses these field names
  const reference     = data?.accountExchangeReference || // ← your PL_ reference
                        data?.reference                ||
                        data?.transactionReference     ||
                        null;

  const accountNumber = data?.accountNumber            || // ← NUBAN
                        data?.destinationAccountNumber ||
                        null;

  const amount        = Number(data?.amount || 0);

  this.logger.log(
    `Processing — ref: ${reference}, account: ${accountNumber}, amount: ₦${amount}`,
  );

  if (!reference && !accountNumber) {
    this.logger.error('No reference or account number in webhook');
    return { received: true, error: 'Missing identifier' };
  }

  // Find invoice by reference OR account number
  let invoice = await this.prisma.vendInvoice.findFirst({
    where: {
      OR: [
        ...(reference     ? [{ reference }]     : []),
        ...(accountNumber ? [{ accountNumber }] : []),
      ],
    },
  });

  if (!invoice) {
    this.logger.warn(
      `Invoice not found — ref: ${reference}, account: ${accountNumber}`,
    );
    // Log all invoices for debug
    const all = await this.prisma.vendInvoice.findMany({
      select: { reference: true, accountNumber: true, status: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    this.logger.warn('Recent invoices in DB:', JSON.stringify(all));
    return { received: true, error: 'Invoice not found' };
  }

  this.logger.log(`Found invoice: ${invoice.id}, status: ${invoice.status}`);

  if (invoice.status === 'SUCCESS') {
    this.logger.warn(`Duplicate webhook — ref: ${reference}`);
    return { received: true, duplicated: true };
  }

  if (invoice.status === 'VENDING') {
    this.logger.warn(`Already vending — ref: ${reference}`);
    return { received: true };
  }

  //  Mark as vending
  await this.prisma.vendInvoice.update({
    where: { id: invoice.id },
    data:  { status: 'VENDING' },
  });

  //  Vend electricity
  try {
    this.logger.log(
      `Vending electricity — meter: ${invoice.meter}, disco: ${invoice.disco}, amount: ₦${invoice.amount}`,
    );

    const vendResult = await this.vendingService.vendElectricity({
      userId:    invoice.userId,
      meter:     invoice.meter,
      disco:     invoice.disco as any,
      vendType:  invoice.vendType as any,
      amount:    invoice.amount,
      phone:     invoice.phone,
      email:     invoice.email,
      name:      invoice.name || undefined,
      reference: `vend-${invoice.reference}`,
    });

    this.logger.log(`Vend result: ${JSON.stringify(vendResult)}`);

    //  Update invoice as success
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

    //  Send email receipt
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

    //  Push + in-app notifications
    await Promise.all([
      this.push.notifyElectricityPurchased(
        invoice.userId,
        vendResult.token || '',
        vendResult.units?.toString() || '0',
        invoice.amount,
      ),
      this.notification.create({
        userId:  invoice.userId,
        title:   ' Electricity Token Ready!',
        message: `Payment received! Token: ${vendResult.token} | ${vendResult.units} kWh | Meter: ${invoice.meter}`,
        type:    'ELECTRICITY',
        metadata: {
          token:     vendResult.token,
          units:     vendResult.units,
          meter:     invoice.meter,
          reference: invoice.reference,
        },
      }),
    ]);

    this.logger.log(
      ` Vend success — ref: ${reference}, token: ${vendResult.token}`,
    );
    return { received: true, success: true };

  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      `Vend failed after payment — ref: ${reference}:`,
      message,
    );

    await this.prisma.vendInvoice.update({
      where: { id: invoice.id },
      data:  { status: 'FAILED' },
    });

    await this.notification.create({
      userId:  invoice.userId,
      title:   '❌ Electricity Vending Failed',
      message: `Your payment was received but vending failed. ` +
               `Contact support with reference: ${reference}. ` +
               `We will resolve within 24 hours.`,
      type:    'WARNING',
    });

    return { received: true, error: message };
  }
}

  //  CHECK INVOICE STATUS 
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
        invoice.status === 'SUCCESS'  ? ` Token ready: ${invoice.token}` :
        invoice.status === 'VENDING'  ? ' Payment received — vending in progress' :
        invoice.status === 'FAILED'   ? ' Vending failed — contact support' :
        isExpired                     ? ' Invoice expired — create a new one' :
                                        ' Awaiting payment',
    };
  }

  //  GET USER INVOICES 
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