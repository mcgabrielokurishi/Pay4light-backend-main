import { Injectable } from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { QueryTransactionsDto } from "./dto/query-transactions.dto";
import { Parser } from 'json2csv';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserTransactions(userId: string, query: QueryTransactionsDto) {
    const { page = 1, limit = 10, type, status } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      userId,
    };

    if (type) where.type = type;
    if (status) where.status = status;

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSingleTransaction(userId: string, id: string) {
    return this.prisma.transaction.findFirst({
      where: {
        id,
        userId, // VERY IMPORTANT
      },
    });
  }
  async getAllUserTransactions(
  userId: string,
  month: number, // 1 - 12
  year: number
) {
  // Start of the month
  const startDate = new Date(year, month - 1, 1);

  // End of the month
  const endDate = new Date(year, month, 0, 23, 59, 59);

  return this.prisma.transaction.findMany({
    where: {
      userId: userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}


async exportUserTransactionsCSV(userId: string) {
  const transactions = await this.prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const fields = [
    'id',
    'type',
    'status',
    'amount',
    'createdAt',
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(transactions);

  return csv;
}
}
