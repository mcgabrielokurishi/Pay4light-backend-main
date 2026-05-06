// src/forecast/forecast.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'database/prisma.service';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { NotificationService } from 'src/notification/notification.service';
import { VendingService } from 'src/vendor/vendor.service';

@Injectable()   
export class ForecastService {
  private readonly logger = new Logger(ForecastService.name);

  constructor(
    private readonly prisma:       PrismaService,
    private readonly push:         PushNotificationService,
    private readonly notification: NotificationService,
    private readonly vendingService: VendingService,
  ) {}

  // ─── CRON — runs every 6 hours ──────────────────────────────────
  @Cron(CronExpression.EVERY_6_HOURS)
  async runForecastCron() {
    this.logger.log('Running token expiry forecast cron...');

    try {
      const meters = await this.prisma.meter.findMany({
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      let processed = 0;
      let alerted   = 0;

      for (const meter of meters) {
        const result = await this.calculateForecastForMeter(
          meter.userId,
          meter.id,
        );

        if (result) {
          processed++;
          if (result.shouldAlert) {
            await this.sendLowUnitsAlert(
              meter.userId,
              meter.meterNumber,
              meter.id,
              result.daysRemaining,
              result.forecastedRunOutAt,
            );
            alerted++;
          }
        }
      }

      this.logger.log(
        `Forecast cron done — processed: ${processed}, alerted: ${alerted}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Forecast cron failed:', errorMessage);
    }
  }
  
@Cron('*/2 * * * *') // every 2 minutes
async reQueryPendingTransactions() {
  const pending = await this.prisma.vendorTransaction.findMany({
    where: {
      status:    'PENDING',
      createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // last 24hrs only
    },
    take: 20,
  });

  if (!pending.length) return;

  this.logger.log(`Re-querying ${pending.length} pending transactions...`);

  for (const tx of pending) {
    try {
      const response = await this.vendingService.reQuery(tx.reference);

      if (response?.success) {
        this.logger.log(`Resolved pending tx: ${tx.reference}`);

        // Notify user if electricity token came back
        if (response.data?.token) {
          await this.push.notifyElectricityPurchased(
            tx.userId,
            response.data.token,
            response.data.units,
            tx.amount,
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Re-query failed for ${tx.reference}: ${errorMessage}`);
    }
  }
}

  // ─── CALCULATE FORECAST FOR ONE METER ───────────────────────────
  async calculateForecastForMeter(userId: string, meterId: string) {
    // Get last 10 successful electricity purchases for this meter
    const purchases = await this.prisma.vendorTransaction.findMany({
      where: {
        userId,
        meterID: meterId,
        status:  'SUCCESS',
        serviceType: 'ELECTRICITY',
      },
      orderBy: { createdAt: 'desc' },
      take:    10,
    });

    if (purchases.length < 2) {
      this.logger.debug(
        `Not enough history for meter ${meterId} — need at least 2 purchases`,
      );
      return null;
    }

    // Calculate average days between purchases
    const intervals: number[] = [];
    for (let i = 0; i < purchases.length - 1; i++) {
      const diff =
        purchases[i].createdAt.getTime() -
        purchases[i + 1].createdAt.getTime();
      intervals.push(diff / (1000 * 60 * 60 * 24));
    }

    const avgDaysBetweenBuys =
      intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Calculate average units per purchase
    const unitsArray = purchases
      .map((p) => parseFloat(p.units || '0'))
      .filter((u) => u > 0);

    const avgUnitsPerBuy =
      unitsArray.length > 0
        ? unitsArray.reduce((a, b) => a + b, 0) / unitsArray.length
        : 0;

    const avgDailyUsage =
      avgUnitsPerBuy > 0 && avgDaysBetweenBuys > 0
        ? avgUnitsPerBuy / avgDaysBetweenBuys
        : 0;

    // Forecast from last purchase date
    const lastPurchase      = purchases[0];
    const lastPurchaseDate  = lastPurchase.createdAt;
    const lastPurchaseUnits = parseFloat(lastPurchase.units || '0');

    const daysSinceLastBuy =
      (Date.now() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24);

    const daysRemaining = Math.max(
      0,
      Math.ceil(avgDaysBetweenBuys - daysSinceLastBuy),
    );

    const forecastedRunOutAt = new Date(
      lastPurchaseDate.getTime() +
        avgDaysBetweenBuys * 24 * 60 * 60 * 1000,
    );

    // Save/update stats
    await this.prisma.meterUsageStats.upsert({
      where:  { userId_meterId: { userId, meterId } },
      update: {
        avgDailyUsage,
        avgDaysBetweenBuys,
        lastPurchaseDate,
        lastPurchaseUnits,
        forecastedRunOutAt,
        daysRemaining,
        lastCalculatedAt: new Date(),
      },
      create: {
        userId,
        meterId,
        avgDailyUsage,
        avgDaysBetweenBuys,
        lastPurchaseDate,
        lastPurchaseUnits,
        forecastedRunOutAt,
        daysRemaining,
      },
    });

    // Alert if 3 days or fewer remaining
    const shouldAlert = daysRemaining <= 3;

    return {
      daysRemaining,
      forecastedRunOutAt,
      avgDaysBetweenBuys:   Math.round(avgDaysBetweenBuys),
      avgDailyUsage:        Number(avgDailyUsage.toFixed(2)),
      lastPurchaseDate,
      lastPurchaseUnits,
      shouldAlert,
    };
  }

  // ─── SEND ALERTS ─────────────────────────────────────────────────
  private async sendLowUnitsAlert(
    userId:             string,
    meterNumber:        string,
    meterId:            string,
    daysRemaining:      number,
    forecastedRunOutAt: Date,
  ) {
    const urgency =
      daysRemaining === 0
        ? '🚨 URGENT'
        : daysRemaining === 1
        ? '⚠️ Very Soon'
        : '🔋 Running Low';

    const message =
      daysRemaining === 0
        ? `Meter ${meterNumber} may have run out of electricity. Buy units now!`
        : `Meter ${meterNumber} may run out in ${daysRemaining} day(s) — around ${forecastedRunOutAt.toDateString()}.`;

    // Push notification
    await this.push.notifyTokenExpiringSoon(userId, daysRemaining, meterNumber);

    // In-app notification
    await this.notification.create({
      userId,
      title:   `${urgency} — Electricity Running Low`,
      message,
      type:    'WARNING',
      metadata: {
        meterId,
        meterNumber,
        daysRemaining,
        forecastedRunOutAt,
      },
    });

    this.logger.log(
      `Alert sent — userId: ${userId}, meter: ${meterNumber}, daysLeft: ${daysRemaining}`,
    );
  }

  // ─── GET FORECAST FOR USER (API) ────────────────────────────────
  async getUserForecast(userId: string) {
    const stats = await this.prisma.meterUsageStats.findMany({
      where:   { userId },
      include: {
        meter: {
          include: { disco: true },
        },
      },
      orderBy: { daysRemaining: 'asc' },
    });

    return stats.map((s) => ({
      meterId:            s.meterId,
      meterNumber:        s.meter.meterNumber,
      disco:              s.meter.disco.name,
      daysRemaining:      s.daysRemaining,
      forecastedRunOutAt: s.forecastedRunOutAt,
      lastPurchaseDate:   s.lastPurchaseDate,
      lastPurchaseUnits:  s.lastPurchaseUnits,
      avgDailyUsage:      s.avgDailyUsage,
      avgDaysBetweenBuys: Math.round(s.avgDaysBetweenBuys),
      lastCalculatedAt:   s.lastCalculatedAt,
      status:
        (s.daysRemaining ?? 99) === 0
          ? 'CRITICAL'
          : (s.daysRemaining ?? 99) <= 3
          ? 'LOW'
          : (s.daysRemaining ?? 99) <= 7
          ? 'MODERATE'
          : 'GOOD',
    }));
  }

  // ─── GET FORECAST FOR ONE METER (API) ───────────────────────────
  async getMeterForecast(userId: string, meterId: string) {
    // Always recalculate fresh when user requests
    const result = await this.calculateForecastForMeter(userId, meterId);

    const meter = await this.prisma.meter.findFirst({
      where:   { id: meterId, userId },
      include: { disco: true },
    });

    if (!meter) return null;

    if (!result) {
      return {
        meterId,
        meterNumber:  meter.meterNumber,
        disco:        meter.disco.name,
        forecast:     null,
        message:      'Not enough purchase history to forecast. Buy electricity at least twice.',
      };
    }

    return {
      meterId,
      meterNumber:        meter.meterNumber,
      disco:              meter.disco.name,
      daysRemaining:      result.daysRemaining,
      forecastedRunOutAt: result.forecastedRunOutAt,
      lastPurchaseDate:   result.lastPurchaseDate,
      lastPurchaseUnits:  result.lastPurchaseUnits,
      avgDailyUsage:      result.avgDailyUsage,
      avgDaysBetweenBuys: result.avgDaysBetweenBuys,
      status:
        result.daysRemaining === 0
          ? 'CRITICAL'
          : result.daysRemaining <= 3
          ? 'LOW'
          : result.daysRemaining <= 7
          ? 'MODERATE'
          : 'GOOD',
      message:
        result.daysRemaining === 0
          ? '🚨 Electricity may have run out. Buy units now!'
          : result.daysRemaining <= 3
          ? `⚠️ Running low! About ${result.daysRemaining} day(s) left.`
          : `✅ You have approximately ${result.daysRemaining} day(s) of electricity left.`,
    };
  }

  // ─── GET USAGE HISTORY FOR ONE METER ────────────────────────────
  async getMeterUsageHistory(userId: string, meterId: string) {
    const purchases = await this.prisma.vendorTransaction.findMany({
      where: {
        userId,
        meterID:     meterId,
        status:      'SUCCESS',
        serviceType: 'ELECTRICITY',
      },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select: {
        id:        true,
        amount:    true,
        units:     true,
        createdAt: true,
        token:     true,
      },
    });

    return purchases.map((p, idx) => {
      const next = purchases[idx + 1];
      const daysBetween = next
        ? Math.round(
            (p.createdAt.getTime() - next.createdAt.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;

      return {
        id:           p.id,
        amount:       p.amount,
        units:        p.units,
        token:        p.token,
        purchaseDate: p.createdAt,
        daysBetween,
      };
    });
  }

  // ─── TRIGGER FORECAST MANUALLY (admin) ──────────────────────────
  async triggerManualForecast() {
    this.logger.log('Manual forecast triggered');
    await this.runForecastCron();
    return { success: true, message: 'Forecast cron triggered manually' };
  }
}