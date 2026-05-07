// src/requery/requery.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'database/prisma.service';
import { WalletService } from 'src/wallet/wallet.service';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { NotificationService } from 'src/notification/notification.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Prisma } from '@prisma/client';

@Injectable()
export class RequeryService {
  private readonly logger  = new Logger(RequeryService.name);
  private readonly baseUrl: string;
  private readonly apiKey:  string;

  constructor(
    private readonly prisma:        PrismaService,
    private readonly walletService: WalletService,
    private readonly push:          PushNotificationService,
    private readonly notification:  NotificationService,
    private readonly httpService:   HttpService,
    private readonly config:        ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('BUYPOWER_BASE_URL') || '';
    this.apiKey  = this.config.get<string>('BUYPOWER_API_KEY')  || '';
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  //CRON — every 2 minutes
  @Cron('*/2 * * * *')
  async runRequeryCron() {
    this.logger.log('Re-query cron started...');

    try {
      const now       = new Date();
      const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const cutoff2m  = new Date(now.getTime() - 2 * 60 * 1000);

      // Find PENDING transactions older than 2 mins but younger than 24hrs
      const pendingTxs = await this.prisma.vendorTransaction.findMany({
        where: {
          status:    'PENDING',
          createdAt: {
            gte: cutoff24h, // not older than 24hrs
            lte: cutoff2m,  // at least 2 minutes old
          },
        },
        orderBy: { createdAt: 'asc' }, // oldest first
        take:    50, // max 50 per run
      });

      if (!pendingTxs.length) {
        this.logger.debug('No pending transactions to re-query');
        return;
      }

      this.logger.log(`Found ${pendingTxs.length} pending transactions to re-query`);

      let resolved = 0;
      let refunded = 0;
      let stillPending = 0;

      for (const tx of pendingTxs) {
        const result = await this.reQuerySingle(tx);

        if (result === 'RESOLVED')      resolved++;
        else if (result === 'REFUNDED') refunded++;
        else                             stillPending++;

        // Small delay between calls to avoid rate limiting
        await this.sleep(500);
      }

      this.logger.log(
        `Re-query done — resolved: ${resolved}, refunded: ${refunded}, still pending: ${stillPending}`,
      );

    } catch (error) {
      this.logger.error('Re-query cron failed:', error instanceof Error ? error.message : String(error));
    }
  }

  // ─── CRON — every hour, auto-expire very old pending txs ────────
  @Cron('0 * * * *')
  async autoExpireOldPending() {
    this.logger.log('Auto-expire cron started...');

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find transactions older than 24hrs still PENDING
    const expiredTxs = await this.prisma.vendorTransaction.findMany({
      where: {
        status:    'PENDING',
        createdAt: { lt: cutoff24h },
      },
    });

    if (!expiredTxs.length) {
      this.logger.debug('No expired transactions found');
      return;
    }

    this.logger.warn(`Auto-expiring ${expiredTxs.length} old pending transactions`);

    for (const tx of expiredTxs) {
      try {
        // Try one last re-query before giving up
        const bpResult = await this.callBuyPowerReQuery(tx.reference);

        if (bpResult?.status === true && bpResult?.responseCode === 200) {
          // Lucky — it came back successful
          await this.markSuccess(tx, bpResult);
          this.logger.log(`Late success on expire — ref: ${tx.reference}`);
          continue;
        }

        // Still not resolved — refund and mark failed
        await this.refundAndMarkFailed(
          tx,
          'Transaction expired after 24 hours without resolution',
        );

        this.logger.warn(`Auto-expired — ref: ${tx.reference}, userId: ${tx.userId}`);

      } catch (error) {
        this.logger.error(`Auto-expire failed for ${tx.reference}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  // ─── RE-QUERY SINGLE TRANSACTION ────────────────────────────────
  private async reQuerySingle(tx: any): Promise<'RESOLVED' | 'REFUNDED' | 'PENDING'> {
    try {
      this.logger.debug(`Re-querying ref: ${tx.reference}`);

      const result = await this.callBuyPowerReQuery(tx.reference);

      if (!result) {
        this.logger.warn(`No response from BuyPower for ref: ${tx.reference}`);
        return 'PENDING';
      }

      const responseCode = result?.responseCode ?? result?.data?.responseCode;

      // ✅ SUCCESS
      if (result?.status === true && responseCode === 200) {
        await this.markSuccess(tx, result);
        return 'RESOLVED';
      }

      // ❌ DEFINITE FAILURE
      if ([400, 401, 402, 403, 404, 422].includes(responseCode)) {
        await this.refundAndMarkFailed(
          tx,
          result?.message || `BuyPower returned error code ${responseCode}`,
        );
        return 'REFUNDED';
      }

      // ⏳ STILL PENDING (202, 500, 502, 503)
      this.logger.debug(
        `Still pending — ref: ${tx.reference}, code: ${responseCode}`,
      );
      return 'PENDING';

    } catch (error) {
      this.logger.error(
        `Re-query error for ref ${tx.reference}:`,
        error instanceof Error ? error.message : String(error),
      );
      return 'PENDING';
    }
  }

  // ─── CALL BUYPOWER RE-QUERY API ──────────────────────────────────
  private async callBuyPowerReQuery(orderId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v2/vend?orderId=${orderId}&getLastResponse=true`,
          {
            headers: this.headers,
            timeout: 15000,
          },
        ),
      );

      this.logger.debug(
        `BuyPower requery response for ${orderId}:`,
        JSON.stringify(response.data),
      );

      return response.data;

    } catch (error) {
      const axiosError = error as any;
      this.logger.warn(
        `BuyPower requery HTTP error for ${orderId}:`,
        axiosError?.response?.data || axiosError?.message,
      );
      return null;
    }
  }

  // ─── MARK SUCCESS ────────────────────────────────────────────────
  private async markSuccess(tx: any, data: any) {
    const vendData = data?.data ?? data;
    const token    = vendData?.token;
    const units    = vendData?.units?.toString();

    await this.prisma.vendorTransaction.update({
      where: { reference: tx.reference },
      data: {
        status:          'SUCCESS',
        token,
        units,
        responsePayload: JSON.stringify(data),
      },
    });

    this.logger.log(
      `Resolved — ref: ${tx.reference}, token: ${token}, units: ${units}`,
    );

    // Notify user
    if (token) {
      await this.push.notifyElectricityPurchased(
        tx.userId,
        token,
        units || '0',
        tx.amount,
      );

      await this.notification.create({
        userId:  tx.userId,
        title:   '⚡ Electricity Token Ready',
        message: `Your electricity token is ready: ${token}. Units: ${units} kWh`,
        type:    'ELECTRICITY',
        metadata: { token, units, reference: tx.reference },
      });
    } else {
      // TV or Data — no token
      await this.notification.create({
        userId:  tx.userId,
        title:   '✅ Transaction Successful',
        message: `Your ${tx.serviceType.toLowerCase()} purchase was successful.`,
        type:    'SUCCESS',
        metadata: { reference: tx.reference },
      });
    }
  }

  // ─── REFUND AND MARK FAILED ──────────────────────────────────────
  private async refundAndMarkFailed(tx: any, reason: string) {
    // Check if already refunded — prevent double refund
    const existing = await this.prisma.vendorTransaction.findUnique({
      where: { reference: tx.reference },
    });

    if (!existing || existing.status !== 'PENDING') {
      this.logger.warn(
        `Skipping refund — tx not pending: ${tx.reference}`,
      );
      return;
    }

    // Refund wallet
    try {
      await this.walletService.credit(
        tx.userId,
        new Prisma.Decimal(tx.amount.toString()),
        `Refund — ${tx.serviceType} purchase failed (${tx.reference})`,
      );
    } catch (error) {
      this.logger.error(
        `Refund failed for ref ${tx.reference}:`,
        error instanceof Error ? error.message : String(error),
      );
    }

    // Mark as failed
    await this.prisma.vendorTransaction.update({
      where: { reference: tx.reference },
      data: {
        status:          'FAILED',
        responsePayload: JSON.stringify({ reason }),
      },
    });

    // Notify user
    await this.push.sendToUser(
      tx.userId,
      '❌ Transaction Failed — Refunded',
      `Your ₦${tx.amount} ${tx.serviceType.toLowerCase()} purchase could not be completed. Your wallet has been refunded.`,
      { type: 'REFUND', reference: tx.reference },
    );

    await this.notification.create({
      userId:  tx.userId,
      title:   '❌ Transaction Failed — Wallet Refunded',
      message: `Your ₦${tx.amount} ${tx.serviceType.toLowerCase()} purchase failed. ₦${tx.amount} has been returned to your wallet.`,
      type:    'WARNING',
      metadata: { reference: tx.reference, reason },
    });

    this.logger.log(
      `Refunded — ref: ${tx.reference}, userId: ${tx.userId}, amount: ${tx.amount}`,
    );
  }

  // ─── MANUAL RE-QUERY (API endpoint) ─────────────────────────────
  async manualReQuery(orderId: string, userId: string) {
    const tx = await this.prisma.vendorTransaction.findFirst({
      where: { reference: orderId, userId },
    });

    if (!tx) {
      return { success: false, message: 'Transaction not found' };
    }

    if (tx.status === 'SUCCESS') {
      return {
        success: true,
        message: 'Transaction already successful',
        data: { token: tx.token, units: tx.units },
      };
    }

    if (tx.status === 'FAILED') {
      return { success: false, message: 'Transaction already failed and refunded' };
    }

    // Re-query now
    const result = await this.reQuerySingle(tx);

    return {
      success: result === 'RESOLVED',
      status:  result,
      message:
        result === 'RESOLVED'  ? 'Transaction resolved successfully' :
        result === 'REFUNDED'  ? 'Transaction failed — wallet refunded' :
                                  'Transaction still processing — please wait',
    };
  }

  // ─── GET PENDING TRANSACTIONS FOR USER ──────────────────────────
  async getPendingTransactions(userId: string) {
    const pending = await this.prisma.vendorTransaction.findMany({
      where:   { userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    return pending.map((tx) => ({
      reference:   tx.reference,
      serviceType: tx.serviceType,
      amount:      tx.amount,
      meterId:     tx.meterID,
      createdAt:   tx.createdAt,
      ageMinutes:  Math.round(
        (Date.now() - tx.createdAt.getTime()) / (1000 * 60),
      ),
    }));
  }

  // ─── HELPER ─────────────────────────────────────────────────────
  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}