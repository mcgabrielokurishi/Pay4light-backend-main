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
import { HttpService } from '@nestjs/axios';

@Injectable()
export class VendInvoiceService {
  private readonly logger         = new Logger(VendInvoiceService.name);
  private readonly SERVICE_CHARGE = 100;
  private readonly baseUrl: string;
  private readonly apiKey:  string;

  constructor(
    private readonly prisma:           PrismaService,
    private readonly configService:      ConfigService,
    private readonly buypowerMfb:      BuypowerMfbService,
    private readonly vendingService:   VendingService,
    private readonly httpService:          HttpService,
    private readonly notification:     NotificationService,
    private readonly push:             PushNotificationService,
    private readonly mailService:      MailService,
  )
   {
    this.baseUrl = this.configService.get<string>('BUYPOWER_BASE_URL_FOR_METER_VEND') || 'https://api.buypower.ng';
    this.apiKey  = this.configService.get<string>('BUYPOWER_API_KEY_FOR_METER_VEND')  || '';
 }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
  }
  }


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

  //  BuyPower returns 'nuban' not 'accountNumber'
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
  const data          = payload?.data || {};
  const reference     = data?.accountExchangeReference || data?.reference;
  const accountNumber = data?.accountNumber;
  const amount        = Number(data?.amount || 0);

  this.logger.log(
    `Processing — ref: ${reference}, account: ${accountNumber}, amount: ₦${amount}`,
  );

  const invoice = await this.prisma.vendInvoice.findFirst({
    where: {
      OR: [
        ...(reference     ? [{ reference }]     : []),
        ...(accountNumber ? [{ accountNumber }] : []),
      ],
    },
  });

  if (!invoice) {
    this.logger.warn(`Invoice not found — ref: ${reference}`);
    return { received: true, error: 'Invoice not found' };
  }

  if (invoice.status === 'SUCCESS') {
    this.logger.warn(`Duplicate webhook — already successful`);
    return { received: true, duplicated: true };
  }

  if (invoice.status === 'VENDING') {
    this.logger.warn(`Already vending`);
    return { received: true };
  }

  this.logger.log(`Found invoice: ${invoice.id}, status: ${invoice.status}`);

  // Mark as vending
  await this.prisma.vendInvoice.update({
    where: { id: invoice.id },
    data:  { status: 'VENDING' },
  });

  //  Try to vend with automatic requery
  await this.vendWithRequery(invoice);

  return { received: true, processing: true };
}

// ─── VEND WITH AUTOMATIC REQUERY 
private async vendWithRequery(invoice: any) {
  const MAX_ATTEMPTS = 5;
  const DELAYS       = [20000, 40000, 60000, 60000, 60000]; // in ms — matches BuyPower's [20,40,60]

  let token: string | null = null;
  let units: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    this.logger.log(`Vend attempt ${attempt}/${MAX_ATTEMPTS} — invoice: ${invoice.id}`);

    try {
      const vendReference = `vend-${invoice.reference}`;

      // First attempt — call vend directly
      if (attempt === 1) {
        const result = await this.vendingService.vendElectricityDirect({
          userId:    invoice.userId,
          meter:     invoice.meter,
          disco:     invoice.disco as any,
          vendType:  invoice.vendType as any,
          amount:    invoice.amount,
          phone:     invoice.phone,
          email:     invoice.email,
          name:      invoice.name || undefined,
          reference: vendReference,
        });

        this.logger.log(`Attempt ${attempt} result: ${JSON.stringify(result)}`);

        if (result.success && result.token) {
          token = result.token;
          units = result.units?.toString() || null;
          break; //  Got token — exit loop
        }

        if (result.pending) {
          this.logger.log(`Attempt ${attempt} pending — waiting ${DELAYS[attempt - 1] / 1000}s`);
          await this.sleep(DELAYS[attempt - 1]);
          continue; // try requery next iteration
        }

      } else {
        // Subsequent attempts — requery using orderId
        this.logger.log(`Requerying orderId: ${vendReference}`);

        const requeryResult = await this.vendingService.reQuery(vendReference);

        this.logger.log(`Requery result: ${JSON.stringify(requeryResult)}`);

        if (requeryResult?.success && requeryResult?.data?.token) {
          token = requeryResult.data.token;
          units = requeryResult.data.units?.toString() || null;
          break; //  Got token — exit loop
        }

        if (attempt < MAX_ATTEMPTS) {
          this.logger.log(`Requery ${attempt} still pending — waiting ${DELAYS[attempt - 1] / 1000}s`);
          await this.sleep(DELAYS[attempt - 1] || 60000);
        }
      }

    } catch (error) {
      this.logger.error(`Attempt ${attempt} error: ${error.message}`);

      if (attempt < MAX_ATTEMPTS) {
        await this.sleep(DELAYS[attempt - 1] || 60000);
      }
    }
  }

  // ─── GOT TOKEN 
  if (token) {
    await this.prisma.vendInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'SUCCESS',
        token,
        units: units || null,
      },
    });

    const user = await this.prisma.user.findUnique({
      where:  { id: invoice.userId },
      select: { email: true, firstName: true, fullName: true },
    });

    const firstName =
      user?.firstName              ||
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

    // Send email
    if (user?.email) {
      this.mailService.sendEmail(
        user.email,
        '⚡ Meter Recharged — Your Token is Ready',
        getMeterRechargeEmail({
          firstName,
          amount:        invoice.amount,
          units:         units || '0',
          meterNumber:   invoice.meter,
          token,
          disco:         invoice.disco,
          reference:     invoice.reference,
          date:          now,
          paymentMethod: 'Bank Transfer (Invoice)',
        }),
      ).catch((err) => this.logger.error(`Email failed: ${err.message}`));
    }

    // Push + in-app
    await Promise.all([
      this.push.notifyElectricityPurchased(
        invoice.userId,
        token,
        units || '0',
        invoice.amount,
      ),
      this.notification.create({
        userId:  invoice.userId,
        title:   '⚡ Electricity Token Ready!',
        message: `Token: ${token} | ${units} kWh | Meter: ${invoice.meter}`,
        type:    'ELECTRICITY',
        metadata: { token, units, meter: invoice.meter, reference: invoice.reference },
      }),
    ]);

    this.logger.log(`✅ Vend success — token: ${token}`);
    return;
  }

  // ─── ALL ATTEMPTS FAILED
  this.logger.error(`All ${MAX_ATTEMPTS} vend attempts failed — invoice: ${invoice.id}`);

  // ✅ Don't mark as FAILED yet — let the re-query cron handle it
  // Just log and notify support
  await this.prisma.vendInvoice.update({
    where: { id: invoice.id },
    data:  { status: 'PENDING' }, // back to pending for cron to pick up
  });

  await this.notification.create({
    userId:  invoice.userId,
    title:   '⏳ Processing Your Electricity',
    message: `Your payment was received. We are processing your electricity token and will notify you shortly. Reference: ${invoice.reference}`,
    type:    'INFO',
  });
}

// ─── SLEEP HELPER 
private sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
async reQuery(orderId: string) {
  try {
    const response = await firstValueFrom(
      this.httpService.get(
        `${this.baseUrl}/v2/vend?orderId=${orderId}&getLastResponse=true`,
        { headers: this.headers },
      ),
    );

    const data     = response.data?.result ?? response.data;
    const vendData = data?.data ?? data;

    this.logger.log(`ReQuery response for ${orderId}: ${JSON.stringify(data)}`);

    // ✅ Check all possible success indicators
    if (
      data?.status === true       ||
      vendData?.responseCode === 100 ||
      vendData?.responseCode === 200 ||
      vendData?.token
    ) {
      // Update vendor transaction if exists
      await this.prisma.vendorTransaction.updateMany({
        where: { reference: orderId },
        data: {
          status: 'SUCCESS',
          token:  vendData?.token,
          units:  vendData?.units?.toString(),
        },
      }).catch(() => {}); // ignore if not found

      return {
        success: true,
        data: {
          token: vendData?.token,
          units: vendData?.units,
        },
      };
    }

    // Still pending
    return {
      success: false,
      pending: true,
      data:    vendData,
    };

  } catch (error) {
    const axiosError = error as any;
    this.logger.error(`ReQuery failed for ${orderId}:`, axiosError?.response?.data);
    return {
      success: false,
      pending: true,
      error:   axiosError?.message,
    };
  }
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