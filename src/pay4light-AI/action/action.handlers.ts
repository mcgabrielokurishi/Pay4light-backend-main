import { PrismaService } from "database/prisma.service";
import { UtilitiesService } from "src/utilies/utilities.service";
import { AIIntent } from "../intent/intent.types";

export class ActionHandlers {
  constructor(
    private prisma: PrismaService,
    private utilitiesService: UtilitiesService
  ) {}

  async handle(intent: AIIntent, userId: string) {

    if (intent === AIIntent.CHECK_BALANCE) {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      return {
        handled: true,
        response: {
          message: `Your wallet balance is ₦${wallet?.balance || 0}.`,
        },
      };
    }

    if (intent === AIIntent.RETRY_PURCHASE) {
      const failedTransaction = await this.prisma.transaction.findFirst({
        where: {
          userId,
          status: "FAILED",
        },
        orderBy: { createdAt: "desc" },
      });

      if (!failedTransaction) {
        return {
          handled: true,
          response: {
            message: "No failed transaction found to retry.",
          },
        };
      }

      const result = await this.utilitiesService.purchaseElectricity(
        userId,
        "IKEDC", // ideally store disco in transaction metadata
        "1234567890",
        failedTransaction.amount.toNumber()
      );

      return {
        handled: true,
        response: {
          message: "Retry successful.",
          data: result,
        },
      };
    }

    return { handled: false };
  }
}
