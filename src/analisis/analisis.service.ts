import { Injectable } from "@nestjs/common";
import { PrismaService } from "database/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}
async getConsumptionHistory(userId: string, month: number, year: number) {
  // Get current month transactions
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth   = new Date(year, month, 0, 23, 59, 59);

  // Get last month range for comparison
  const startOfLastMonth = new Date(year, month - 2, 1);
  const endOfLastMonth   = new Date(year, month - 1, 0, 23, 59, 59);

  const [currentTxns, lastTxns] = await Promise.all([
    this.prisma.transaction.findMany({
      where: {
        userId,
        status: 'SUCCESS',
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
    }),
    this.prisma.transaction.findMany({
      where: {
        userId,
        status: 'SUCCESS',
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    }),
  ]);

  // Calculate totals
  const totalKwh  = currentTxns.reduce((sum, tx) => sum + Number((tx.metadata as any)?.kwh ?? 0), 0);
  const totalCost = currentTxns.reduce((sum, tx) => sum + tx.amount, 0);

  const lastKwh   = lastTxns.reduce((sum, tx) => sum + Number((tx.metadata as any)?.kwh ?? 0), 0);
  const lastCost  = lastTxns.reduce((sum, tx) => sum + tx.amount, 0);

  // Compare
  const usagePercent = lastKwh  ? ((totalKwh  - lastKwh)  / lastKwh)  * 100 : 0;
  const costPercent  = lastCost ? ((totalCost - lastCost) / lastCost) * 100 : 0;

  // Weekly breakdown (W1–W4)
  const weeks = [1, 2, 3, 4].map((w) => {
    const weekStart = new Date(year, month - 1, (w - 1) * 7 + 1);
    const weekEnd   = new Date(year, month - 1, w * 7);

    const weekTxns = currentTxns.filter(
      (tx) => tx.createdAt >= weekStart && tx.createdAt <= weekEnd,
    );

    return {
      week: `W${w}`,
      kwh:  weekTxns.reduce((sum, tx) => sum + Number((tx.metadata as any)?.kwh ?? 0), 0),
      cost: weekTxns.reduce((sum, tx) => sum + tx.amount, 0),
    };
  });

  const daysInMonth    = endOfMonth.getDate();
  const averageDailyUsage = totalKwh / daysInMonth;

  return {
    averageDailyUsage: +averageDailyUsage.toFixed(1),
    totalKwh:  +totalKwh.toFixed(1),
    totalCost: +totalCost.toFixed(2),
    comparison: {
      usage: {
        percent: +usagePercent.toFixed(1),
        label: `${Math.abs(usagePercent).toFixed(1)}% ${usagePercent <= 0 ? 'lower' : 'higher'} than last month`,
      },
      cost: {
        percent: +costPercent.toFixed(1),
        label: `${Math.abs(costPercent).toFixed(1)}% ${costPercent <= 0 ? 'lower' : 'higher'} than last month`,
      },
    },
    weeklyBreakdown: weeks,
    kwhPerMonth: {
      percent: +usagePercent.toFixed(1),
      label: `${Math.abs(usagePercent).toFixed(1)}% ${usagePercent >= 0 ? 'higher' : 'lower'} than last`,
    },
  };
}
}

