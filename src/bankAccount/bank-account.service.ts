import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { AddBankAccountDto } from "./dto/add-bank-account.dto";

const MAX_BANK_ACCOUNTS = 5;

@Injectable()
export class BankAccountService {
  private readonly logger = new Logger(BankAccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────
  // ADD BANK ACCOUNT
  // ─────────────────────────────────────────────────────────────────

  async addBankAccount(userId: string, dto: AddBankAccountDto) {
    // Limit: max 5 bank accounts per user
    const count = await this.prisma.bankAccount.count({ where: { userId } });
    if (count >= MAX_BANK_ACCOUNTS) {
      throw new BadRequestException(
        `Maximum of ${MAX_BANK_ACCOUNTS} bank accounts allowed`,
      );
    }

    // Check for duplicate account number for this user
    const existing = await this.prisma.bankAccount.findUnique({
      where: {
        userId_accountNumber: {
          userId,
          accountNumber: dto.accountNumber,
        },
      },
    });
    if (existing) {
      throw new BadRequestException("This bank account is already saved");
    }

    // If this is set as default, unset all others first
    if (dto.isDefault) {
      await this.clearDefault(userId);
    }

    // If this is the first account, auto-set as default
    const isDefault = dto.isDefault ?? count === 0;

    const bankAccount = await this.prisma.bankAccount.create({
      data: {
        userId,
        bankName: dto.bankName,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
        isDefault,
      },
    });

    this.logger.log(`Bank account added for user ${userId}: ${dto.accountNumber}`);
    return bankAccount;
  }

  // ─────────────────────────────────────────────────────────────────
  // GET ALL BANK ACCOUNTS
  // ─────────────────────────────────────────────────────────────────

  async getBankAccounts(userId: string) {
    return this.prisma.bankAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // SET DEFAULT BANK ACCOUNT
  // ─────────────────────────────────────────────────────────────────

  async setDefault(userId: string, accountId: string) {
    const account = await this.findAndVerifyOwnership(userId, accountId);

    if (account.isDefault) {
      return account; // already default, nothing to do
    }

    await this.clearDefault(userId);

    return this.prisma.bankAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // DELETE BANK ACCOUNT
  // ─────────────────────────────────────────────────────────────────

  async deleteBankAccount(userId: string, accountId: string) {
    const account = await this.findAndVerifyOwnership(userId, accountId);

    await this.prisma.bankAccount.delete({ where: { id: accountId } });

    // If the deleted account was default, promote the next newest to default
    if (account.isDefault) {
      const next = await this.prisma.bankAccount.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (next) {
        await this.prisma.bankAccount.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    this.logger.log(`Bank account ${accountId} deleted for user ${userId}`);
    return { message: "Bank account removed successfully" };
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async findAndVerifyOwnership(userId: string, accountId: string) {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException("Bank account not found");
    }

    if (account.userId !== userId) {
      throw new ForbiddenException("Access denied");
    }

    return account;
  }

  private async clearDefault(userId: string) {
    await this.prisma.bankAccount.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
