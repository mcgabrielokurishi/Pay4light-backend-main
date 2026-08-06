import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'database/prisma.service';
import { WalletService } from 'src/wallet/wallet.service';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { BuypowerMfbService } from 'src/buypower-mfb/buypower-mfb.service';
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
  private readonly SERVICE_CHARGE = 100;

  constructor(
    private readonly httpService:         HttpService,
    private readonly configService:       ConfigService,
    private readonly prisma:              PrismaService,
    private readonly walletService:       WalletService,
    private readonly notificationService: NotificationService,
    private readonly mailService:         MailService,
    private readonly push:                PushNotificationService,
    private readonly notifManager:        NotificationManagerService,
    private readonly buypowerMfb:         BuypowerMfbService,
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

  // ─── CHECK METER ──
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

  // ─── CHECK DISCO STATUS 
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

  // ─── GET BUYPOWER VENDING WALLET BALANCE ─────────────────────────
  async getBuyPowerBalance(): Promise<number> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v2/wallet/balance`,
          { headers: this.headers },
        ),
      );
      const balance = response.data?.balance ?? 0;
      this.logger.log(`BuyPower vending wallet balance: ${balance}`);
      return Number(balance);
    } catch (error) {
      this.logger.error('Failed to fetch BuyPower vending balance');
      return 999999; // don't block vending if check fails
    }
  }

  // ─── GET USER RESERVED ACCOUNT BALANCE ───────────────────────────
  private async getUserReservedBalance(userId: string): Promise<number> {
    try {
      const balanceResponse = await this.buypowerMfb.getReservedAccountBalance(userId);
      const balance = balanceResponse?.data?.balance ?? balanceResponse?.balance ?? 0;
      this.logger.log(`User ${userId} reserved balance: ₦${balance}`);
      return Number(balance);
    } catch (error) {
      this.logger.error(`Failed to get reserved balance for ${userId}:`, error.message);
      return -1; // signal failure
    }
  }

  // ─── VEND ELECTRICITY ─────────────────────────────────────────────
  async vendElectricity(userId: string, dto: VendElectricityDto) {
    const totalAmount  = dto.amount + this.SERVICE_CHARGE;
    const orderId      = randomUUID();
    const reference    = orderId;
    const totalDecimal = new Prisma.Decimal(totalAmount.toString());

    // ✅ CHECK 1 — BuyPower MFB reserved account balance
    const reservedBalance = await this.getUserReservedBalance(userId);

    if (reservedBalance === -1) {
      throw new BadRequestException(
        'Unable to verify your account balance. Please try again.',
      );
    }

    if (reservedBalance < totalAmount) {
      throw new BadRequestException(
        `Insufficient balance. You need ₦${totalAmount.toLocaleString()} ` +
        `(₦${dto.amount.toLocaleString()} electricity + ₦${this.SERVICE_CHARGE} service charge). ` +
        `Your balance is ₦${reservedBalance.toLocaleString()}. Please fund your account.`,
      );
    }

    // ✅ CHECK 2 — Wallet not locked
    const userWallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!userWallet) throw new BadRequestException('Wallet not found');
    if (userWallet.locked) throw new BadRequestException('Wallet is locked. Contact support.');

    // ✅ CHECK 3 — BuyPower vending wallet has enough
    const bpBalance = await this.getBuyPowerBalance();
    if (bpBalance < dto.amount) {
      throw new BadRequestException(
        'Service temporarily unavailable. Please try again in a few minutes.',
      );
    }

    // ─── GET USER INFO ─
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true, fullName: true, firstName: true, lastName: true },
    });

    const customerName =
      dto.name ||
      user?.fullName ||
      `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() ||
      'Pay4Light Customer';

    const firstName =
      user?.firstName ||
      user?.fullName?.split(' ')[0] ||
      'Customer';

    // ─── NOTIFY SERVICE CHARGE ──────────────────────────────────────
    await this.notificationService.create({
      userId,
      title:   '💡 Service Charge Notice',
      message: `A service charge of ₦${this.SERVICE_CHARGE} will be deducted alongside your ` +
               `₦${dto.amount.toLocaleString()} electricity purchase. Total: ₦${totalAmount.toLocaleString()}.`,
      type:    'INFO',
    });

    // ─── SAVE PENDING TRANSACTION ───────────────────────────────────
    await this.prisma.vendorTransaction.create({
      data: {
        userId,
        reference,
        provider:       'BUYPOWER',
        serviceType:    'ELECTRICITY',
        meterID:        dto.meter,
        amount:         dto.amount,
        status:         'PENDING',
        requestPayload: JSON.parse(JSON.stringify(dto)),
      },
    });

    // ✅ DEBIT INTERNAL WALLET
    // Sync reserved balance to internal wallet first if needed
    await this.syncAndDebit(userId, userWallet, totalDecimal, reference, dto.amount);

    // ─── RECORD SERVICE CHARGE AS REVENUE 
    await this.prisma.revenueEntry.create({
      data: {
        userId,
        amount:      this.SERVICE_CHARGE,
        type:        'ELECTRICITY',
        reference:   `svc-${reference}`,
        description: `Service charge for electricity vend — meter ${dto.meter}`,
      },
    });

    // ─── CALL BUYPOWER ─
    try {
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
            amount:      dto.amount.toString(),
            phone:       dto.phone,
            email:       dto.email || user?.email || '',
            name:        customerName,
          },
          { headers: this.headers, timeout: 60000 },
        ),
      );

      const data         = response.data;
      const responseCode = data?.responseCode ?? data?.data?.responseCode;

      this.logger.log(`Vend response: ${JSON.stringify(data)}`);

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
          serviceCharge: this.SERVICE_CHARGE,
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

        const meter = await this.prisma.meter.findFirst({
          where:   { meterNumber: dto.meter },
          include: { disco: true },
        });

        const now = new Date().toLocaleString('en-NG', {
          timeZone: 'Africa/Lagos',
          day:      'numeric',
          month:    'long',
          year:     'numeric',
          hour:     '2-digit',
          minute:   '2-digit',
        });

        if (user?.email) {
          this.mailService.sendEmail(
            user.email,
            '⚡ Meter Recharged — Your Token is Ready',
            getMeterRechargeEmail({
              firstName,
              amount:        dto.amount,
              units:         vendData?.units?.toString() || '0',
              meterNumber:   dto.meter,
              token:         vendData?.token || '',
              disco:         meter?.disco?.name || dto.disco,
              reference,
              date:          now,
              paymentMethod: 'Wallet',
              meterNickname: meter?.address || 'My Meter',
            }),
          ).catch((err) =>
            this.logger.error(`Failed to send recharge email: ${err.message}`),
          );
        }

        await Promise.all([
          this.notificationService.create({
            userId,
            title:   '⚡ Electricity Purchased Successfully',
            message: `Token: ${vendData?.token} | Units: ${vendData?.units} kWh | ` +
                     `₦${dto.amount.toLocaleString()} + ₦${this.SERVICE_CHARGE} service charge deducted.`,
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
          serviceCharge: this.SERVICE_CHARGE,
          totalDeducted: totalAmount,
          data: {
            orderId,
            reference,
            token:           vendData?.token,
            units:           vendData?.units,
            amountPaid:      dto.amount,
            serviceCharge:   this.SERVICE_CHARGE,
            totalDeducted:   totalAmount,
            amountGenerated: vendData?.amountGenerated,
            tax:             vendData?.tax,
            receiptNo:       vendData?.receiptNo,
            disco:           vendData?.disco,
            debtAmount:      vendData?.debtAmount,
            debtRemaining:   vendData?.debtRemaining,
          },
        };
      }

      throw new Error(data?.message || 'Vending failed');

    } catch (error) {
      const axiosError   = error as any;
      const errorData    = axiosError?.response?.data;
      const errorMsg     = errorData?.message || axiosError?.message || 'Vending failed';
      const responseCode = errorData?.responseCode;

      this.logger.error(`Vending failed — orderId: ${orderId}`, errorData);

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

      // Refund on definite failure
      await this.walletService.credit(
        userId,
        totalDecimal,
        `Refund — electricity purchase failed (${orderId}) including service charge`,
      );

      await this.prisma.revenueEntry.deleteMany({
        where: { reference: `svc-${reference}` },
      });

      await this.prisma.vendorTransaction.update({
        where: { reference },
        data:  { status: 'FAILED', responsePayload: errorData || errorMsg },
      });

      throw new BadRequestException(
        `Vending failed. ₦${totalAmount.toLocaleString()} refunded. Reason: ${errorMsg}`,
      );
    }
  }

  // ─── SYNC RESERVED BALANCE TO INTERNAL WALLET THEN DEBIT ─────────
  // This solves the core problem — internal wallet may be 0
  // even though reserved account has funds
  private async syncAndDebit(
    userId:     string,
    wallet:     any,
    amount:     Prisma.Decimal,
    reference:  string,
    vendAmount: number,
  ) {
    const internalBalance = Number(wallet.balance);

    // ✅ If internal wallet is less than amount needed — sync from reserved
    if (internalBalance < amount.toNumber()) {
      const reservedBalance = await this.getUserReservedBalance(userId);
      const deficit = amount.toNumber() - internalBalance;

      if (reservedBalance >= deficit) {
        // Credit internal wallet from reserved balance
        await this.walletService.credit(
          userId,
          new Prisma.Decimal(deficit.toString()),
          `Sync from reserved account — ₦${deficit}`,
        );
        this.logger.log(
          `Synced ₦${deficit} from reserved to internal wallet for user ${userId}`,
        );
      }
    }

    // Now debit from internal wallet
    await this.walletService.debitWithIdempotency(
      userId,
      amount,
      reference,
      `Electricity ₦${vendAmount.toLocaleString()} + Service charge ₦${this.SERVICE_CHARGE}`,
    );
  }

  // ─── VEND ELECTRICITY DIRECTLY (for invoice payments) ────────────
  async vendElectricityDirect(dto: {
    userId:    string;
    meter:     string;
    disco:     any;
    vendType:  any;
    amount:    number;
    phone:     string;
    email?:    string;
    name?:     string;
    reference: string;
  }) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v2/vend?strict=0`,
          {
            orderId:     dto.reference,
            meter:       dto.meter,
            disco:       dto.disco,
            vendType:    dto.vendType,
            paymentType: 'B2B',
            vertical:    'ELECTRICITY',
            amount:      dto.amount.toString(),
            phone:       dto.phone,
            email:       dto.email || '',
            name:        dto.name  || 'Pay4Light Customer',
            rtt:         true,
          },
          { headers: this.headers, timeout: 60000 },
        ),
      );

      const data         = response.data;
      const responseCode = data?.responseCode ?? data?.data?.responseCode;

      this.logger.log(`Vend response: ${JSON.stringify(data)}`);

      if (data?.status === true && responseCode === 200) {
        return {
          success: true,
          token:   data.data?.token,
          units:   data.data?.units,
        };
      }

      if ([202, 500, 502, 503].includes(responseCode)) {
        return {
          success: false,
          pending: true,
          token:   null,
          units:   null,
        };
      }

      throw new Error(data?.message || 'Vending failed');

    } catch (error) {
      const axiosError = error as any;
      this.logger.error('vendElectricityDirect failed:', axiosError?.response?.data || error.message);
      throw new BadRequestException(
        axiosError?.response?.data?.message ||
        error.message ||
        'Vending failed',
      );
    }
  }

  // ─── VEND TV 
  async vendTv(userId: string, dto: VendTvDto) {
    const orderId   = randomUUID();
    const amount    = new Prisma.Decimal(dto.amount.toString());
    const reference = orderId;

    const reservedBalance = await this.getUserReservedBalance(userId);
    if (reservedBalance < dto.amount) {
      throw new BadRequestException(
        `Insufficient balance. You have ₦${reservedBalance.toLocaleString()} but need ₦${dto.amount.toLocaleString()}.`,
      );
    }

    const userWallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!userWallet) throw new BadRequestException('Wallet not found');
    if (userWallet.locked) throw new BadRequestException('Wallet is locked');

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

    await this.syncAndDebit(userId, userWallet, amount, reference, dto.amount);

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

      await this.walletService.credit(userId, amount, `Refund — TV subscription failed (${orderId})`);
      await this.prisma.vendorTransaction.update({
        where: { reference },
        data:  { status: 'FAILED', responsePayload: errorMsg },
      });

      throw new BadRequestException(`TV vending failed. Wallet refunded. Reason: ${errorMsg}`);
    }
  }

  // ─── VEND DATA 
  async vendData(userId: string, dto: VendDataDto) {
    const orderId   = randomUUID();
    const amount    = new Prisma.Decimal(dto.amount.toString());
    const reference = orderId;

    const reservedBalance = await this.getUserReservedBalance(userId);
    if (reservedBalance < dto.amount) {
      throw new BadRequestException(
        `Insufficient balance. You have ₦${reservedBalance.toLocaleString()} but need ₦${dto.amount.toLocaleString()}.`,
      );
    }

    const userWallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!userWallet) throw new BadRequestException('Wallet not found');
    if (userWallet.locked) throw new BadRequestException('Wallet is locked');

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

    await this.syncAndDebit(userId, userWallet, amount, reference, dto.amount);

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

      await this.walletService.credit(userId, amount, `Refund — data purchase failed (${orderId})`);
      await this.prisma.vendorTransaction.update({
        where: { reference },
        data:  { status: 'FAILED', responsePayload: errorMsg },
      });

      throw new BadRequestException(`Data vending failed. Wallet refunded. Reason: ${errorMsg}`);
    }
  }

  // ─── RE-QUERY 
  async reQuery(orderId: string) {
    const url = `${this.baseUrl}/v2/vend?orderId=${orderId}&getLastResponse=true`;

    try {
      this.logger.log(`ReQuery GET ${url}`);

      const response = await firstValueFrom(
        this.httpService.get(url, { headers: this.headers }),
      );

      const data     = response.data?.result ?? response.data;
      const vendData = data?.data ?? data;

      this.logger.log(`ReQuery response for ${orderId}: ${JSON.stringify(data)}`);

      if (vendData?.responseCode === 100 || vendData?.responseCode === 200 || data?.status === true) {
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
        pending: [202, 500, 502, 503].includes(vendData?.responseCode),
        data:    vendData,
      };

    } catch (error) {
      const axiosError = error as any;
      this.logger.error(`ReQuery failed for ${orderId}:`, axiosError?.message);
      return { success: false, pending: true, data: null };
    }
  }

  // ─── GET PRICE LIST 
  async getPriceList(vertical: string, disco?: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v2/prices`,
          { headers: this.headers, params: { vertical, ...(disco ? { disco } : {}) } },
        ),
      );
      return response.data;
    } catch (error) {
      throw new BadRequestException('Failed to fetch price list');
    }
  }
}