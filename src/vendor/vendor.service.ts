

import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'database/prisma.service';
import { WalletService } from 'src/wallet/wallet.service';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { MailService } from 'src/common/services/mail.service';
import { NotificationService } from 'src/notification/notification.service';
import { getMeterRechargeEmail } from 'src/common/template/email.template';
import { VendElectricityDto } from './dto/vend-electricity.dto';
import { VendTvDto } from './dto/vend-tv.dto';
import { VendDataDto } from './dto/vend-data.dto';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { NotificationManagerService } from 'src/notification-settings/notification-manager.service';

@Injectable()
export class VendingService {
  private readonly logger  = new Logger(VendingService.name);
  private readonly baseUrl: string;
  private readonly apiKey:  string;

  constructor(
    private readonly httpService:          HttpService,
    private readonly configService:        ConfigService,
    private readonly prisma:               PrismaService,
    private readonly walletService:        WalletService,
    private readonly notificationService:  NotificationService,
    private readonly mailService:         MailService,
    private readonly push:                 PushNotificationService,
    private readonly notifManager: NotificationManagerService
  ) {
    this.baseUrl = this.configService.get<string>('BUYPOWER_BASE_URL_FOR_METER_VEND') || 'https://api.buypower.ng';
    this.apiKey  = this.configService.get<string>('BUYPOWER_API_KEY_FOR_METER_VEND')  || '';
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // ─── CHECK METER ──────────────────────────────────────────────────
  async checkMeter(meter: string, disco: string, vendType: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v2/check/meter`,
          {
            headers: this.headers,
            params:  { meter, disco, vendType, vertical: 'ELECTRICITY', orderid: 'false' },
          },
        ),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      this.logger.error('Check meter failed', axiosError?.response?.data);
      throw new BadRequestException(
        axiosError?.response?.data?.message || 'Failed to verify meter',
      );
    }
  }

  // ─── CHECK DISCO STATUS ───────────────────────────────────────────
  async checkDiscoStatus() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/discos/status`,
          { headers: this.headers },
        ),
      );
      return response.data;
    } catch (error) {
      throw new BadRequestException('Failed to fetch DISCO status');
    }
  }

  // ─── GET BUYPOWER WALLET BALANCE ─────────────────────────────────
  // Uses the correct URL: https://idev.buypower.ng/v2/wallet/balance
  async getBuyPowerBalance(): Promise<number> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v2/wallet/balance`, // ✅ correct endpoint
          { headers: this.headers },
        ),
      );

      const balance = response.data?.balance ?? 0;
      this.logger.log(`BuyPower wallet balance: ${balance}`);
      return Number(balance);

    } catch (error) {
      const axiosError = error as any;
      this.logger.error(
        'Failed to fetch BuyPower balance:',
        axiosError?.response?.data,
      );
      // Don't block vending if balance check fails — log and continue
      return 999999;
    }
  }

  // ─── VEND ELECTRICITY ─────────────────────────────────────────────
 async vendElectricity(userId: string, dto: VendElectricityDto) {
  const SERVICE_CHARGE = 100; // ₦100 per vend
  const totalAmount    = dto.amount + SERVICE_CHARGE; // e.g ₦500 + ₦100 = ₦600
  const orderId        = randomUUID();
  const amount         = new Prisma.Decimal(dto.amount.toString());
  const reference      = orderId;

  // ✅ Check user wallet has enough for amount + service charge
  const userWallet = await this.prisma.wallet.findUnique({
    where: { userId },
  });

  if (!userWallet) throw new BadRequestException('Wallet not found');
  if (userWallet.locked) throw new BadRequestException('Wallet is locked');

  if (Number(userWallet.balance) < totalAmount) {
    throw new BadRequestException(
      `Insufficient balance. You need ₦${totalAmount.toLocaleString()} ` +
      `(₦${dto.amount} electricity + ₦${SERVICE_CHARGE} service charge). ` +
      `Your balance is ₦${Number(userWallet.balance).toLocaleString()}.`,
    );
  }

  // ✅ Notify user about service charge BEFORE deducting
  await this.notificationService.create({
    userId,
    title:   '💡 Service Charge Notice',
    message: `A service charge of ₦${SERVICE_CHARGE} will be deducted alongside your ₦${dto.amount} electricity purchase. Total: ₦${totalAmount}.`,
    type:    'INFO',
  });

  // Get user info
  const user = await this.prisma.user.findUnique({
    where:  { id: userId },
    select: { email: true, fullName: true, firstName: true, lastName: true },
  });

  const customerName =
    dto.name ||
    user?.fullName ||
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() ||
    'Pay4Light Customer';

  // ✅ Save pending transaction
  await this.prisma.vendorTransaction.create({
    data: {
      userId,
      reference,
      provider:       'BUYPOWER',
      serviceType:    'ELECTRICITY',
      meterID:        dto.meter,
      amount:         dto.amount,   // actual electricity amount only
      status:         'PENDING',
      requestPayload: JSON.parse(JSON.stringify(dto)),
    },
  });

  // ✅ Debit TOTAL (electricity + service charge) from wallet
  const totalDecimal = new Prisma.Decimal(totalAmount.toString());
  await this.walletService.debitWithIdempotency(
    userId,
    totalDecimal,
    reference,
    `Electricity ₦${dto.amount} + Service charge ₦${SERVICE_CHARGE}`,
  );

  // ✅ Record the ₦100 service charge as revenue
  await this.prisma.revenueEntry.create({
    data: {
      userId,
      amount:      SERVICE_CHARGE,
      type:        'ELECTRICITY',
      reference:   `svc-${reference}`,
      description: `Service charge for electricity vend — meter ${dto.meter}`,
    },
  });

  try {
    // Call BuyPower with ORIGINAL amount (not total)
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/v2/vend`,
        {
          orderId,
          meter:       dto.meter,
          disco:       dto.disco,
          vendType:    dto.vendType,
          paymentType: 'B2B',
          vertical:    'ELECTRICITY',
          amount:      dto.amount.toString(), // ← only electricity amount to BuyPower
          phone:       dto.phone,
          email:       dto.email || user?.email || '',
          name:        customerName,
        },
        { headers: this.headers, timeout: 60000 },
      ),
    );

    const data         = response.data;
    const responseCode = data?.responseCode ?? data?.data?.responseCode;

    // PENDING
    if ([202, 500, 502, 503].includes(responseCode)) {
      await this.prisma.vendorTransaction.update({
        where: { reference },
        data:  { status: 'PENDING', responsePayload: data },
      });

      return {
        success:       false,
        pending:       true,
        message:       'Transaction is being processed. Please check back shortly.',
        orderId,
        reference,
        amountPaid:    dto.amount,
        serviceCharge: SERVICE_CHARGE,
        totalDeducted: totalAmount,
      };
    }

    // SUCCESS
    if (data?.status === true && responseCode === 200) {
      const vendData = data.data;

      await this.prisma.vendorTransaction.update({
        where: { reference },
        data: {
          status:          'SUCCESS',
          responsePayload: data,
          token:           vendData?.token,
          units:           vendData?.units?.toString(),
        },
      });

      // ✅ Notify success with full breakdown
      await Promise.all([
        this.notificationService.create({
          userId,
          title:   '⚡ Electricity Purchased Successfully',
          message: `Token: ${vendData?.token} | Units: ${vendData?.units} kWh | ₦${dto.amount} electricity + ₦${SERVICE_CHARGE} service charge deducted.`,
          type:    'ELECTRICITY',
        }),
        this.push.notifyElectricityPurchased(
          userId,
          vendData?.token,
          vendData?.units,
          dto.amount,
        ),
      ]);

      return {
        success:       true,
        message:       'Electricity purchased successfully',
        serviceCharge: SERVICE_CHARGE,
        totalDeducted: totalAmount,
        data: {
          orderId,
          reference,
          token:           vendData?.token,
          units:           vendData?.units,
          amountPaid:      dto.amount,
          serviceCharge:   SERVICE_CHARGE,
          totalDeducted:   totalAmount,
          amountGenerated: vendData?.amountGenerated,
          tax:             vendData?.tax,
          receiptNo:       vendData?.receiptNo,
          disco:           vendData?.disco,
        },
      };
    }

    throw new Error(data?.message || 'Vending failed');

  } catch (error) {
    const axiosError   = error as any;
    const errorData    = axiosError?.response?.data;
    const errorMsg     = errorData?.message || axiosError?.message || 'Vending failed';
    const responseCode = errorData?.responseCode;

    if ([202, 500, 502, 503].includes(responseCode)) {
      await this.prisma.vendorTransaction.update({
        where: { reference },
        data:  { status: 'PENDING', responsePayload: errorData },
      });

      return {
        success:   false,
        pending:   true,
        message:   'Transaction is being processed. Re-query after 2 minutes.',
        orderId,
        reference,
      };
    }

    // ✅ Refund FULL amount including service charge on failure
    await this.walletService.credit(
      userId,
      totalDecimal,
      `Refund — electricity purchase failed (${orderId}) including service charge`,
    );

    // ✅ Remove the revenue entry since vend failed
    await this.prisma.revenueEntry.deleteMany({
      where: { reference: `svc-${reference}` },
    });

    await this.prisma.vendorTransaction.update({
      where: { reference },
      data:  { status: 'FAILED', responsePayload: errorData || errorMsg },
    });

    throw new BadRequestException(
      `Vending failed. Full amount of ₦${totalAmount} (including service charge) refunded. Reason: ${errorMsg}`,
    );
  }
}

  // ─── VEND TV ─────────────────────────────────────────────────────
  async vendTv(userId: string, dto: VendTvDto) {
    const orderId   = randomUUID();
    const amount    = new Prisma.Decimal(dto.amount.toString());
    const reference = orderId;

    // ✅ Check user wallet balance
    const userWallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!userWallet) throw new BadRequestException('Wallet not found');
    if (userWallet.locked) throw new BadRequestException('Wallet is locked');
    if (Number(userWallet.balance) < dto.amount) {
      throw new BadRequestException(
        `Insufficient balance. You have ₦${Number(userWallet.balance).toLocaleString()} but need ₦${dto.amount.toLocaleString()}`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true, fullName: true },
    });

    await this.prisma.vendorTransaction.create({
      data: {
        userId,
        reference,
        provider:       'BUYPOWER',
        serviceType:    'TV',
        meterID:        dto.meter,
        amount:         amount.toNumber(),
        status:         'PENDING',
        requestPayload: JSON.parse(JSON.stringify(dto)),
      },
    });

    await this.walletService.debitWithIdempotency(
      userId, amount, reference,
      `TV subscription — ${dto.disco} decoder ${dto.meter}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v2/vend`,
          {
            orderId,
            meter:       dto.meter,
            disco:       dto.disco,
            tariffClass: dto.tariffClass,
            paymentType: 'B2B',
            vertical:    'TV',
            amount:      dto.amount.toString(),
            phone:       dto.phone,
            email:       dto.email || user?.email || '',
            name:        dto.name  || user?.fullName || 'Pay4Light Customer',
          },
          { headers: this.headers, params: { strict: 0 }, timeout: 60000 },
        ),
      );

      const data = response.data;

      if (data?.status === true && data?.responseCode === 200) {
        await this.prisma.vendorTransaction.update({
          where: { reference },
          data:  { status: 'SUCCESS', responsePayload: data },
        });

        return {
          success: true,
          message: 'TV subscription successful',
          data: {
            orderId,
            reference,
            receiptNo:  data.data?.receiptNo,
            amountPaid: data.data?.totalAmountPaid,
            disco:      data.data?.disco,
          },
        };
      }

      throw new Error(data?.message || 'TV vending failed');

    } catch (error) {
      const axiosError = error as any;
      const errorMsg   = axiosError?.response?.data?.message || axiosError?.message || 'TV vending failed';

      await this.walletService.credit(
        userId, amount,
        `Refund — TV subscription failed (${orderId})`,
      );

      await this.prisma.vendorTransaction.update({
        where: { reference },
        data:  { status: 'FAILED', responsePayload: errorMsg },
      });

      throw new BadRequestException(
        `TV vending failed. Wallet refunded. Reason: ${errorMsg}`,
      );
    }
  }

  // ─── VEND DATA ────────────────────────────────────────────────────
  async vendData(userId: string, dto: VendDataDto) {
    const orderId   = randomUUID();
    const amount    = new Prisma.Decimal(dto.amount.toString());
    const reference = orderId;

    // ✅ Check user wallet balance
    const userWallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!userWallet) throw new BadRequestException('Wallet not found');
    if (userWallet.locked) throw new BadRequestException('Wallet is locked');
    if (Number(userWallet.balance) < dto.amount) {
      throw new BadRequestException(
        `Insufficient balance. You have ₦${Number(userWallet.balance).toLocaleString()} but need ₦${dto.amount.toLocaleString()}`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true, fullName: true },
    });

    await this.prisma.vendorTransaction.create({
      data: {
        userId,
        reference,
        provider:       'BUYPOWER',
        serviceType:    'DATA',
        meterID:        dto.meter,
        amount:         amount.toNumber(),
        status:         'PENDING',
        requestPayload: JSON.parse(JSON.stringify(dto)),
      },
    });

    await this.walletService.debitWithIdempotency(
      userId, amount, reference,
      `Data purchase — ${dto.disco} for ${dto.meter}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v2/vend`,
          {
            orderId,
            meter:       dto.meter,
            disco:       dto.disco,
            tariffClass: dto.tariffClass,
            paymentType: 'B2B',
            vertical:    'DATA',
            amount:      dto.amount.toString(),
            phone:       dto.phone,
            email:       dto.email || user?.email || '',
            name:        dto.name  || user?.fullName || 'Pay4Light Customer',
          },
          { headers: this.headers, params: { strict: 0 }, timeout: 60000 },
        ),
      );

      const data = response.data;

      if (data?.status === true && data?.responseCode === 200) {
        await this.prisma.vendorTransaction.update({
          where: { reference },
          data:  { status: 'SUCCESS', responsePayload: data },
        });

        return {
          success: true,
          message: 'Data purchase successful',
          data: {
            orderId,
            reference,
            receiptNo:  data.data?.receiptNo,
            amountPaid: data.data?.totalAmountPaid,
            units:      data.data?.units,
            disco:      data.data?.disco,
          },
        };
      }

      throw new Error(data?.message || 'Data vending failed');

    } catch (error) {
      const axiosError = error as any;
      const errorMsg   = axiosError?.response?.data?.message || axiosError?.message || 'Data vending failed';

      await this.walletService.credit(
        userId, amount,
        `Refund — data purchase failed (${orderId})`,
      );

      await this.prisma.vendorTransaction.update({
        where: { reference },
        data:  { status: 'FAILED', responsePayload: errorMsg },
      });

      throw new BadRequestException(
        `Data vending failed. Wallet refunded. Reason: ${errorMsg}`,
      );
    }
  }

  // ─── RE-QUERY ─────────────────────────────────────────────────────
  async reQuery(orderId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v2/vend?orderId=${orderId}&getLastResponse=true`,
          { headers: this.headers },
        ),
      );

      const data     = response.data?.result ?? response.data;
      const vendData = data?.data;

      if (vendData?.responseCode === 100 || data?.status === true) {
        await this.prisma.vendorTransaction.updateMany({
          where: { reference: orderId },
          data: {
            status:          'SUCCESS',
            token:           vendData?.token,
            units:           vendData?.units?.toString(),
            responsePayload: data,
          },
        });
      }

      return {
        success: data?.status ?? false,
        data:    vendData,
      };

    } catch (error) {
      const axiosError = error as any;
      throw new BadRequestException(
        axiosError?.response?.data?.message || 'Re-query failed',
      );
    }
  }

  // ─── GET PRICE LIST ───────────────────────────────────────────────
  async getPriceList(vertical: string, disco?: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v2/prices`,
          {
            headers: this.headers,
            params:  { vertical, ...(disco ? { disco } : {}) },
          },
        ),
      );
      return response.data;
    } catch (error) {
      throw new BadRequestException('Failed to fetch price list');
    }
  }
}