import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { MonnifyService } from "src/monnify/monnify.service";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PushNotificationService } from "src/push-notification/push-notification.service";
import { BuypowerService } from "../buypower/buypower.service";
import { NotificationManagerService } from "src/notification-settings/notification-manager.service";
import { MailService } from 'src/common/services/mail.service';
import { getWalletFundedEmail } from 'src/common/template/email.template';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma:          PrismaService,
    private readonly buypowerService: BuypowerService,
    private readonly push:            PushNotificationService,
    private readonly monnifyService:  MonnifyService,
    private readonly notifManager:    NotificationManagerService,
    private readonly mailService:     MailService,
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
    if (!wallet) throw new BadRequestException("Wallet not found");
    return wallet;
  }

  // PROVISION VIRTUAL ACCOUNT
  async provisionVirtualAccount(user: {
    id:        string;
    firstName: string;
    lastName:  string;
    email:     string;
    bvn?:      string;
  }) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: user.id },
    });

    if (!wallet) throw new BadRequestException('Wallet not found');

    // Already provisioned — return existing
    if (wallet.virtualAccountNuban) {
      return {
        accountNumber:  wallet.virtualAccountNuban,
        bankName:       wallet.virtual_account_bank,
        accountName:    `${user.firstName} ${user.lastName}`,
        alreadyExisted: true,
        // If multiple banks stored in metadata
        accounts:       wallet.virtual_account_meta
          ? JSON.parse(wallet.virtual_account_meta as string)
          : null,
      };
    }

    const fullName = `${user.firstName} ${user.lastName}`;

    //  Call Monnify to create reserved account
    const result = await this.monnifyService.createReservedAccount({
      accountReference: user.id,     // userId as unique reference
      accountName:      fullName,
      customerEmail:    user.email,
      customerName:     fullName,
      bvn:              user.bvn,
      nin:              '95791401413'
    });

    this.logger.log('Monnify reserved account result:', JSON.stringify(result));

    //  Monnify returns array of accounts (one per bank)
    // accounts: [{ bankName, bankCode, accountNumber }]
    const accounts = result?.accounts || [];
    const primary  = accounts[0];

    if (!primary?.accountNumber) {
      this.logger.error('No account number in Monnify response:', result);
      throw new InternalServerErrorException(
        'Could not provision virtual account — please try again',
      );
    }

    // Save primary account + all accounts as metadata
    const updatedWallet = await this.prisma.wallet.update({
      where: { userId: user.id },
      data: {
        virtualAccountNuban:  primary.accountNumber,
        virtual_account_bank: primary.bankName,
        virtual_account_ref:  user.id,
        virtual_account_meta: JSON.stringify(accounts), // all banks
      },
    });

    this.logger.log(
      `Virtual account provisioned — user: ${user.id}, account: ${primary.accountNumber}`,
    );

    return {
      accountNumber:  updatedWallet.virtualAccountNuban,
      bankName:       updatedWallet.virtual_account_bank,
      accountName:    fullName,
      alreadyExisted: false,
      accounts,      //  return ALL bank options (Wema, Providus etc.)
    };
  }

async findByAccountNumber(accountNumber: string): Promise<{ id: string } | null> {
  const wallet = await this.prisma.wallet.findFirst({
    where: {
      OR: [
        { virtualAccountNuban: accountNumber },
        //  Also check metadata for secondary bank accounts
      ],
    },
  });

  if (!wallet) return null;
  return { id: wallet.userId };
}

async findUserByNubanOrReference(
  nuban: string,
  reference: string,
): Promise<{ id: string } | null> {
  // Try matching primary nuban or the stored virtual_account_ref (user-created reference)
  const wallet = await this.prisma.wallet.findFirst({
    where: {
      OR: [
        { virtualAccountNuban: nuban || undefined },
        { virtual_account_ref: reference || undefined },
        // also check metadata (virtual_account_meta) which may contain other account numbers
        {
          virtual_account_meta: {
            contains: nuban || reference || '',
          },
        },
      ],
    },
  });

  if (!wallet) return null;
  return { id: wallet.userId };
}

  // CREDIT FROM WEBHOOK
  async creditFromWebhook(
    userId:      string,
    amount:      number,
    externalRef: string,
    meta: { description?: string; metadata?: Record<string, any> } = {},
  ) {
    const decimalAmount = new Prisma.Decimal(amount);

    if (decimalAmount.lte(0)) throw new BadRequestException("Invalid amount");

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
        data:  { balance: { increment: decimalAmount.toNumber() } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId:    wallet.id,
          type:        "WALLET_CREDIT",
          amount:      decimalAmount.toNumber(),
          status:      "SUCCESS",
          reference:   externalRef,
          description: meta.description || "Wallet funding via BuyPower MFB",
          metadata:    JSON.stringify({}),
        },
      });

      //  Push notification after credit
      await this.push.notifyWalletCredited(userId, decimalAmount.toNumber());
      await this.notifManager.notifyWalletCredited(userId, amount, externalRef);

      this.logger.log(
        `Wallet credited — userId: ${userId}, amount: NGN${amount}, ref: ${externalRef}`,
      );

      //  Send wallet funded email
      const userDetails = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, fullName: true },
      });

      const firstName =
        userDetails?.firstName || userDetails?.fullName?.split(' ')[0] || 'Customer';

      const now = new Date().toLocaleString('en-NG', {
        timeZone: 'Africa/Lagos',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      if (userDetails?.email) {
        this.mailService
          .sendEmail(
            userDetails.email,
            ' Wallet Funded — Pay4light.ng',
            getWalletFundedEmail({
              firstName,
              amount: decimalAmount.toNumber(),
              newBalance: Number(updatedWallet.balance),
              paymentMethod: meta.description?.includes('card')
                ? 'Card Payment'
                : 'Bank Transfer',
              reference: externalRef,
              date: now,
            }),
          )
          .catch((err) =>
            this.logger.error(`Failed to send wallet funded email: ${err?.message || err}`),
          );
      }

      return { wallet: updatedWallet, transaction, duplicated: false };
    });
  }

  // CREDIT (internal)
  async credit(
    userId:      string,
    amount:      Prisma.Decimal,
    description = "Wallet credit",
  ) {
    if (amount.lte(0)) throw new BadRequestException("Invalid amount");

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException("Wallet not found");
      if (wallet.locked) throw new ForbiddenException("Wallet is locked");

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data:  { balance: { increment: amount.toNumber() } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          walletId:    wallet.id,
          type:        "WALLET_CREDIT",
          amount:      amount.toNumber(),
          status:      "SUCCESS",
          reference:   randomUUID(),
          description,
          metadata:    JSON.stringify({}),
        },
      });

      //  Push notification
      await this.push.notifyWalletCredited(userId, amount.toNumber());
      await this.notifManager.notifyWalletCredited(userId, amount.toNumber());
      return { wallet: updatedWallet, transaction };

      

    });
  }


  // Add inside WalletService class
async getAllWalletNubans() {
  return this.prisma.wallet.findMany({
    select: {
      userId:               true,
      virtualAccountNuban:  true,
      virtual_account_ref:  true,
      balance:              true,
    },
  });
}

  // DEBIT WITH IDEMPOTENCY
  
async debitWithIdempotency(
  userId:      string,
  amount:      Prisma.Decimal,
  reference:   string,
  description = 'Wallet debit',
) {
  if (amount.lte(0)) throw new BadRequestException('Invalid amount');

  const result = await this.prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({ where: { reference } });
    if (existing) {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      return { wallet, transaction: existing, duplicated: true };
    }

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new BadRequestException('Wallet not found');
    if (wallet.locked) throw new ForbiddenException('Wallet is locked');
    if (wallet.balance < amount.toNumber())
      throw new BadRequestException('Insufficient balance');

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data:  { balance: { decrement: amount.toNumber() } },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        walletId:    wallet.id,
        type:        'WALLET_DEBIT',
        amount:      amount.toNumber(),
        reference,
        status:      'SUCCESS',
        description,
        metadata:    JSON.stringify({}),
        //  Remove meterId completely — don't pass empty string
      },
    });

    return { wallet: updatedWallet, transaction, duplicated: false };
  });

  if (!result.duplicated) {
    await this.push.notifyWalletDebited(userId, amount.toNumber());
  }

  return result;
}

//  DEBIT
async debit(
  userId:      string,
  amount:      Prisma.Decimal,
  description = 'Wallet debit',
) {
  if (amount.lte(0)) throw new BadRequestException('Invalid amount');

  return this.prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new BadRequestException('Wallet not found');
    if (wallet.locked) throw new ForbiddenException('Wallet is locked');
    if (wallet.balance < amount.toNumber())
      throw new BadRequestException('Insufficient balance');

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data:  { balance: { decrement: amount.toNumber() } },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        walletId:    wallet.id,
        type:        'WALLET_DEBIT',
        amount:      amount.toNumber(),
        status:      'SUCCESS',
        reference:   randomUUID(),
        description,
        metadata:    JSON.stringify({}),
        //  No meterId here either
      },
    });

    await this.push.notifyWalletDebited(userId, amount.toNumber());

    return { wallet: updatedWallet, transaction };
  });
}
}