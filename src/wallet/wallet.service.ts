import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { BuypowerService } from "../buypower/buypower.service";

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly buypowerService: BuypowerService,
  ) {}
 
  // CREATE WALLET
  async createWalletForUser(userId: string) {
    return this.prisma.wallet.create({
      data: { userId },
    });
  }

  
  // GET WALLET
  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new BadRequestException("Wallet not found");
    }

    return wallet;
  }

  // ─────────────────────────────────────────────────────────────────
  // PROVISION VIRTUAL ACCOUNT
  // Idempotent — safe to call multiple times
  // ─────────────────────────────────────────────────────────────────
  async provisionVirtualAccount(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: user.id },
    });

    if (!wallet) {
      throw new BadRequestException("Wallet not found — create wallet first");
    }

    // Already provisioned — return existing
    if (wallet.virtualAccountNuban) {
      this.logger.log(`Virtual account already exists for user ${user.id}`);
      return {
        nuban: wallet.virtualAccountNuban,
        bankName: wallet.virtual_account_bank,
        accountName: `${user.firstName} ${user.lastName}`,
        alreadyExisted: true,
      };
    }

    // Call BuyPower API
    let nuban: string;
    let bankName: string;

    try {
      const result = await this.buypowerService.createReservedAccount({
        reference: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      });

      nuban = result?.data?.nuban;
      bankName = result?.data?.bankName || "BuyPower MFB";

      if (!nuban) {
        throw new Error("BuyPower returned no NUBAN");
      }
    } catch (error) {
      this.logger.error(
        `BuyPower account creation failed for user ${user.id}`,
        error,
      );
      throw new InternalServerErrorException(
        "Could not provision virtual account — please try again",
      );
    }

    // Save to wallet
    const updatedWallet = await this.prisma.wallet.update({
      where: { userId: user.id },
      data: {
        virtualAccountNuban: nuban,
        virtual_account_bank: bankName,
        virtual_account_ref: user.id,
      },
    });

    this.logger.log(
      `Virtual account provisioned — user: ${user.id}, nuban: ${nuban}`,
    );

    return {
      nuban: updatedWallet.virtualAccountNuban,
      bankName: updatedWallet.virtual_account_bank,
      accountName: `${user.firstName} ${user.lastName}`,
      alreadyExisted: false,
    };
  }

  // FIND USER BY NUBAN OR REFERENCE (used by webhook)
  async findUserByNubanOrReference(
    nuban: string,
    reference: string,
  ): Promise<{ id: string } | null> {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        OR: [
          { virtualAccountNuban: nuban },
          { virtual_account_ref: reference },
        ],
      },
    });

    if (!wallet) return null;
    return { id: wallet.userId };
  }

  // CREDIT FROM WEBHOOK (idempotent via externalRef)
  async creditFromWebhook(
    userId: string,
    amount: number,
    externalRef: string,
    meta: { description?: string; metadata?: Record<string, any> } = {},
  ) {
    const decimalAmount = new Prisma.Decimal(amount);

    if (decimalAmount.lte(0)) {
      throw new BadRequestException("Invalid amount");
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({
        where: { reference: externalRef },
      });
      if (existing) {
        this.logger.warn(`Duplicate webhook — ref: ${externalRef}`);
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        return { wallet, transaction: existing, duplicated: true };
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException("Wallet not found");
      if (wallet.locked) throw new ForbiddenException("Wallet is locked");

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: decimalAmount.toNumber() } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "WALLET_CREDIT",
          amount: decimalAmount.toNumber(),
          status: "SUCCESS",
          reference: externalRef,
          description: meta.description || "Wallet funding via BuyPower MFB",
          metadata: JSON.stringify({}),
        },
      });

      this.logger.log(
        `Wallet credited — userId: ${userId}, amount: NGN${amount}, ref: ${externalRef}`,
      );

      return { wallet: updatedWallet, transaction, duplicated: false };
    });
  }

  // CREDIT (internal/manual)
  async credit(
    userId: string,
    amount: Prisma.Decimal,
    description = "Wallet credit",
  ) {
    if (amount.lte(0)) throw new BadRequestException("Invalid amount");

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException("Wallet not found");
      if (wallet.locked) throw new ForbiddenException("Wallet is locked");

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount.toNumber() } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "WALLET_CREDIT",
          amount : amount.toNumber(),
          status: "SUCCESS",
          reference: randomUUID(),
          description,
          metadata: JSON.stringify({}),
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  // DEBIT
  async debit(
    userId: string,
    amount: Prisma.Decimal,
    description = "Wallet debit",
  ) {
    if (amount.lte(0)) throw new BadRequestException("Invalid amount");

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException("Wallet not found");
      if (wallet.locked) throw new ForbiddenException("Wallet is locked");
      if (wallet.balance < amount.toNumber())
        throw new BadRequestException("Insufficient balance");

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount.toNumber() } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "WALLET_DEBIT",
          amount : amount.toNumber(),
          status: "SUCCESS",
          reference: randomUUID(),
          description,
          meterId: "",
          metadata: JSON.stringify({}),
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  // DEBIT WITH IDEMPOTENCY
  async debitWithIdempotency(
    userId: string,
    amount: Prisma.Decimal,
    reference: string,
    description = "Wallet debit",
  ) {
    if (amount.lte(0)) throw new BadRequestException("Invalid amount");

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { reference } });
      if (existing) {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        return { wallet, transaction: existing, duplicated: true };
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException("Wallet not found");
      if (wallet.locked) throw new ForbiddenException("Wallet is locked");
      if (wallet.balance < amount.toNumber())
        throw new BadRequestException("Insufficient balance");

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount.toNumber() } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "WALLET_DEBIT",
          amount: amount.toNumber(),
          reference,
          meterId: "",
          status: "SUCCESS",
          description,
          metadata: JSON.stringify({}),
        },
      });

      return { wallet: updatedWallet, transaction, duplicated: false };
    });
  }
}
