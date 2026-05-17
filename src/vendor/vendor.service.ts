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
import {NotificationService} from 'src/notification/notification.service';
import { VendElectricityDto } from './dto/vend-electricity.dto';
import { VendTvDto } from './dto/vend-tv.dto';
import { VendDataDto } from './dto/vend-data.dto';
import { PushNotificationService } from 'src/push-notification/push-notification.service';

@Injectable()
export class VendingService {
  private readonly logger = new Logger(VendingService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly push: PushNotificationService,
  ) {
    this.baseUrl = this.configService.get<string>('BUYPOWER_BASE_URL_FOR_METER_VEND') || 'https://api.buypower.ng';
    this.apiKey  = this.configService.get<string>('BUYPOWER_API_KEY_FOR_METER_VEND')  || '27bbb1199a0efa41c81261a2314bf9faa90ff404a8d7e6ee20992e117c3e83df';
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }
  

  //CHECK METER
  async checkMeter(meter: string, disco: string, vendType: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v2/check/meter`,
          {
            headers: this.headers,
            params: { meter, disco, vendType, vertical: 'ELECTRICITY',orderid: "false" },
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

  //  CHECK DISCO STATUS 
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

  // VEND ELECTRICITY 
  async vendElectricity(userId: string, dto: VendElectricityDto) {
    const orderId   = randomUUID();
    const amount    = new Prisma.Decimal(dto.amount.toString());
    const reference = orderId;

    // Check DISCO is online first
    
    // Get user info for name/email
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true, firstName: true, lastName: true },
    });

    const customerName =
      dto.name ||
      user?.fullName ||
      `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() ||
      'Pay4Light Customer';

    // Save PENDING transaction
    await this.prisma.vendorTransaction.create({
      data: {
        userId,
        reference,
        provider: 'BUYPOWER',
        serviceType: 'ELECTRICITY',
        meterID: dto.meter,
        amount : amount.toNumber(),
        status: 'PENDING',
        requestPayload: JSON.parse(JSON.stringify(dto)),
      },
    });

    // Debit wallet BEFORE calling BuyPower (idempotent)
    await this.walletService.debitWithIdempotency(
      userId,
      amount,
      reference,
      `Electricity purchase — ${dto.disco} meter ${dto.meter}`,
    );

    try {
      // Call BuyPower vend endpoint
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

      // ─── PENDING (202 / 500 / 502 / 503) — re-query later ──────
      if ([202, 500, 502, 503].includes(responseCode)) {
        this.logger.warn(`Vend pending — orderId: ${orderId}`);
        await this.prisma.vendorTransaction.update({
          where: { reference },
          data: { status: 'PENDING', responsePayload: data },
        });

        return {
          success: false,
          pending: true,
          message: 'Transaction is being processed. Please check back shortly.',
          orderId,
          reference,
        };
      }

      // ─── SUCCESS (200) ──────────────────────────────────────────
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

        this.logger.log(`Electricity vended — orderId: ${orderId}, token: ${vendData?.token}`);

        await this.notificationService.notifyElectricity(
          userId,
          `✅ Electricity purchased! Token: ${vendData?.token}. Units: ${vendData?.units} kWh`,
          { token: vendData?.token, units: vendData?.units, orderId },
        );

        return {
          success:      true,
          message:      'Electricity purchased successfully',
          data: {
            orderId,
            reference,
            token:          vendData?.token,
            units:          vendData?.units,
            amountPaid:     vendData?.totalAmountPaid,
            amountGenerated: vendData?.amountGenerated,
            tax:            vendData?.tax,
            receiptNo:      vendData?.receiptNo,
            disco:          vendData?.disco,
            debtAmount:     vendData?.debtAmount,
            debtRemaining:  vendData?.debtRemaining,
          },
        };
            await this.push.notifyElectricityPurchased(
              userId,
              vendData?.token,
              vendData?.units,
              dto.amount,
    );
      }

      // ─── FAILED ─────────────────────────────────────────────────
      throw new Error(data?.message || 'Vending failed');

    } catch (error) {
      const axiosError  = error as any;
      const errorData   = axiosError?.response?.data;
      const errorMsg    = errorData?.message || axiosError?.message || 'Vending failed';
      const responseCode = errorData?.responseCode;

      this.logger.error(`Vending failed — orderId: ${orderId}`, errorData);

      // If pending response code — don't refund, re-query later
      if ([202, 500, 502, 503].includes(responseCode)) {
        await this.prisma.vendorTransaction.update({
          where: { reference },
          data: { status: 'PENDING', responsePayload: errorData },
        });

        return {
          success: false,
          pending: true,
          message: 'Transaction is being processed. Please re-query after 2 minutes.',
          orderId,
          reference,
        };
      }

      // Definite failure — refund wallet
      await this.walletService.credit(
        userId,
        amount,
        `Refund — electricity purchase failed (${orderId})`,
      );

      await this.prisma.vendorTransaction.update({
        where: { reference },
        data: { status: 'FAILED', responsePayload: errorData || errorMsg },
      });

      throw new BadRequestException(
        `Vending failed. Wallet refunded. Reason: ${errorMsg}`,
      );
    }
  }

  // ─── VEND TV 
  async vendTv(userId: string, dto: VendTvDto) {
    const orderId   = randomUUID();
    const amount    = new Prisma.Decimal(dto.amount.toString());
    const reference = orderId;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    await this.prisma.vendorTransaction.create({
      data: {
        userId,
        reference,
        provider:    'BUYPOWER',
        serviceType: 'TV',
        meterID:     dto.meter,
        amount : amount.toNumber(),
        status:      'PENDING',
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
          data: { status: 'SUCCESS', responsePayload: data },
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
        data: { status: 'FAILED', responsePayload: errorMsg },
      });

      throw new BadRequestException(`TV vending failed. Wallet refunded. Reason: ${errorMsg}`);
    }
  }

  // ─── VEND DATA
  async vendData(userId: string, dto: VendDataDto) {
    const orderId   = randomUUID();
    const amount    = new Prisma.Decimal(dto.amount.toString());
    const reference = orderId;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    await this.prisma.vendorTransaction.create({
      data: {
        userId,
        reference,
        provider:    'BUYPOWER',
        serviceType: 'DATA',
        meterID:     dto.meter,
        amount : amount.toNumber(),
        status:      'PENDING',
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
          data: { status: 'SUCCESS', responsePayload: data },
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
        data: { status: 'FAILED', responsePayload: errorMsg },
      });

      throw new BadRequestException(`Data vending failed. Wallet refunded. Reason: ${errorMsg}`);
    }
  }

  // ─── RE-QUERY ───────────────────────────────────────────────────
  async reQuery(orderId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v2/transaction/${orderId}`,
          { headers: this.headers },
        ),
      );

      const data     = response.data?.result ?? response.data;
      const vendData = data?.data;

      // Update local transaction
      if (vendData?.responseCode === 100 || data?.status === true) {
        await this.prisma.vendorTransaction.updateMany({
          where: { reference: orderId },
          data: {
            status: 'SUCCESS',
            token:  vendData?.token,
            units:  vendData?.units?.toString(),
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

  // ─── GET PRICE LIST ─────────────────────────────────────────────
  async getPriceList(vertical: string, disco?: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v2/prices`,
          {
            headers: this.headers,
            params: { vertical, ...(disco ? { disco } : {}) },
          },
        ),
      );
      return response.data;
    } catch (error) {
      throw new BadRequestException('Failed to fetch price list');
    }
  }

  // ─── GET BUYPOWER WALLET BALANCE ────────────────────────────────
  async getBuyPowerBalance() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v2/wallet/balance`,
          { headers: this.headers },
        ),
      );
      return response.data;
    } catch (error) {
      throw new BadRequestException('Failed to fetch BuyPower balance');
    }
  }
}
