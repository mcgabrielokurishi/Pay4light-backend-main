import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { Logger } from "@nestjs/common";
import { BuypowerService } from "../buypower/buypower.service";

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly buypowerService: BuypowerService,
  ) {
    console.log("WalletService initialized");
  }

  // CREATE WALLET


  async createWalletForUser(userId: string) {
    return this.prisma.wallet.create({
      data: { userId },
    });
  }


  // VIRTUAL ACCOUNT — BuyPower MFB Reserved Account


  /**
   * Provision a permanent BuyPower virtual account for a user.
   * Call this once after user registration (in UserService.create).
   * The user transfers money to this NUBAN to fund their wallet.
   *
   * @returns { nuban, bankName } — show this to the user on the wallet screen
   */
  async provisionVirtualAccount(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }) {
    // Return existing account if already provisioned
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: user.id },
    });

    if (!wallet) {
      throw new BadRequestException("Wallet not found");
    }

    if (wallet.virtualAccountNuban) {
      return {
        nuban: wallet.virtualAccountNuban,
        bankName: wallet.virtual_account_ref,
      };
    }

    // Call BuyPower API to create reserved account
    const result = await this.buypowerService.createReservedAccount({
      reference: user.id, // user UUID — used to identify user in webhook
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
    });

    const nuban: string = result?.data?.nuban;
    const bankName: string = result?.data?.bankName || "BuyPower MFB";

    if (!nuban) {
      throw new BadRequestException("Failed to provision virtual account");
    }

    // Persist the virtual account details on the wallet
    await this.prisma.wallet.update({
      where: { userId: user.id },
      data: {
        virtualAccountNuban: nuban,
        virtual_account_bank: bankName,
        virtual_account_ref: user.id,
      },
    });

    this.logger.log(`Virtual account provisioned for user ${user.id}: ${nuban}`);
    return { nuban, bankName };
  }

 
  async getVirtualAccount(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new BadRequestException("Wallet not found");
    }

    return {
      balance: wallet.balance,
      nuban: wallet.virtualAccountNuban,
      bankName: wallet.virtual_account_bank|| "BuyPower MFB",
      accountName: wallet.virtual_account_ref
        ? "Your Name" // replace with actual user name lookup if needed
        : null,
      isProvisioned: !!wallet.virtualAccountNuban,
    };
  }

 
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


  // GET WALLET


  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    console.log("user", userId);

    if (!wallet) {
      throw new BadRequestException("Wallet not found");
    }

    return wallet;
  }

  // CREDIT WALLET
  // Used by: existing flows AND the BuyPower webhook handler
  
 
  async credit(
    userId: string,
    amount: Prisma.Decimal,
    description = "Wallet credit",
  ) {
    if (amount.lte(0)) {
      throw new BadRequestException("Invalid amount");
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException("Wallet not found");
      if (wallet.locked) throw new ForbiddenException("Wallet is locked");

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: Number(amount) } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "WALLET_CREDIT",
          amount: Number(amount),
          status: "SUCCESS",
          reference: randomUUID(),
          description,
          metadata: "{}",
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  /**
   * Credit via BuyPower webhook — includes idempotency check using externalRef.
   * This is what the webhook controller calls when a bank transfer lands.
   *
   * @param userId      - the wallet owner
   * @param amount      - amount received in Naira
   * @param externalRef - BuyPower's transaction ID (prevents double-credit)
   * @param meta        - extra info to store on the transaction record
   */
  async creditFromWebhook(
    userId: string,
    amount: number,
    externalRef: string,
    meta: {
      description?: string;
      metadata?: Record<string, any>;
    } = {},
  ) {
    const decimalAmount = new Prisma.Decimal(amount);

    if (decimalAmount.lte(0)) {
      throw new BadRequestException("Invalid amount");
    }

    return this.prisma.$transaction(async (tx) => {
      // ── Idempotency: bail out if this BuyPower txn was already processed ──
      const existing = await tx.transaction.findUnique({
        where: { reference: externalRef },
      });
      if (existing) {
        this.logger.warn(`Duplicate webhook ignored — externalRef: ${externalRef}`);
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        return { wallet, transaction: existing, duplicated: true };
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException("Wallet not found");
      if (wallet.locked) throw new ForbiddenException("Wallet is locked");

      // ── Increment balance ──
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: Number(decimalAmount) } },
      });

      // ── Log the transaction ──
      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "WALLET_CREDIT",
          amount: Number(decimalAmount),
          status: "SUCCESS",
          reference: externalRef,     // BuyPower txn ID — UNIQUE in DB
          description: meta.description || "Wallet funding via BuyPower MFB",
          metadata: meta.metadata ? JSON.stringify(meta.metadata) : "{}",
        },
      });

      this.logger.log(
        `Wallet credited — userId: ${userId}, amount: ₦${amount}, ref: ${externalRef}`,
      );

      return { wallet: updatedWallet, transaction, duplicated: false };
    });
  }


  // DEBIT WALLET

  async debit(
    userId: string,
    amount: Prisma.Decimal,
    description = "Wallet debit",
  ) {
    if (amount.lte(0)) {
      throw new BadRequestException("Invalid amount");
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException("Wallet not found");
      if (wallet.locked) throw new ForbiddenException("Wallet is locked");
      if (wallet.balance < Number(amount))
        throw new BadRequestException("Insufficient balance");

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: Number(amount) } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "WALLET_DEBIT",
          amount: Number(amount),
          status: "SUCCESS",
          reference: randomUUID(),
          description,
          meterId: "",
          metadata: "{}",
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  // DEBIT WITH IDEMPOTENCY (Production Safe)


  async debitWithIdempotency(
    userId: string,
    amount: Prisma.Decimal,
    reference: string,
    description = "Wallet debit",
  ) {
    if (amount.lte(0)) {
      throw new BadRequestException("Invalid amount");
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { reference } });
      if (existing) {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        return { wallet, transaction: existing, duplicated: true };
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException("Wallet not found");
      if (wallet.locked) throw new ForbiddenException("Wallet is locked");
      if (wallet.balance < Number(amount))
        throw new BadRequestException("Insufficient balance");

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: Number(amount) } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "WALLET_DEBIT",
          amount: Number(amount),
          reference,
          meterId: "",
          status: "SUCCESS",
          description,
          metadata: "{}",
        },
      });

      return { wallet: updatedWallet, transaction, duplicated: false };
    });
  }
}