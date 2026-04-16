import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { MockElectricityProvider } from "./providers/mock-electricity.provider";
import { randomUUID } from "crypto";

@Injectable()
export class UtilitiesService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    private provider: MockElectricityProvider
  ) {}

  async validateMeter(disco: string, meterNumber: string) {
    return this.provider.validateMeter(disco, meterNumber);
  }

  async purchaseElectricity(
    userId: string,
    disco: string,
    meterNumber: string,
    amount: number
  ) {
    return this.prisma.$transaction(async (tx) => {

      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet || wallet.balance < amount) {
        throw new BadRequestException("Insufficient balance");
      }

      // Deduct wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "ELECTRICITY_PURCHASE",
          amount,
          status: "PENDING",
          reference: randomUUID(),
          meterId: "",
          metadata: "{}",
          description: "Electricity purchase",
        },
      });

      // Call provider
      const result = await this.provider.purchase(
        disco,
        meterNumber,
        amount
      );

      if (!result.success) {
        throw new Error("Provider failed");
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "SUCCESS",
          // token: result.token,
        },
      });

      return {
        token: result.token,
        units: result.units,
      };
    });
  }
}
