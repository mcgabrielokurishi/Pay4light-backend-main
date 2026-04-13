import { Injectable } from "@nestjs/common";
import { PrismaService } from "database/prisma.service";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalTransactions,
      totalWalletBalance,
      successfulTransactions,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.transaction.count(),
      this.prisma.wallet.aggregate({
        _sum: { balance: true },
      }),
      this.prisma.transaction.count({
        where: { status: "SUCCESS" },
      }),
    ]);

    return {
      totalUsers,
      totalTransactions,
      totalWalletBalance: totalWalletBalance._sum.balance || 0,
      successfulTransactions,
    };
  }
  async getUsers(page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  return this.prisma.user.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
}

}
