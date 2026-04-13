
import { PrismaService } from "database/prisma.service";

export async function buildUserContext(
  prisma: PrismaService,
  userId: string
) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  const lastTransaction = await prisma.transaction.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const failedTransaction = await prisma.transaction.findFirst({
    where: {
      userId,
      status: "FAILED",
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    walletBalance: wallet?.balance || 0,
    lastTransaction,
    failedTransaction,
  };
}