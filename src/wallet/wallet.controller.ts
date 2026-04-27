import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { WalletService } from "./wallet.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Prisma } from "@prisma/client";
import { PrismaService } from "database/prisma.service";
import { CreditWalletDto } from "./dto/credit.dto";

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

@Controller("wallet")
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly prisma: PrismaService,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // GET /wallet
  // ─────────────────────────────────────────────────────────────────
  @Get()
  async getWallet(@Req() req: any) {
    return this.walletService.getWallet(req.user.id);
  }

  // ─────────────────────────────────────────────────────────────────
  // POST /wallet/provision-virtual-account
  // Creates a permanent BuyPower MFB virtual account for the user.
  // Safe to call multiple times — returns existing if already provisioned.
  // ─────────────────────────────────────────────────────────────────
  @Post('provision-virtual-account')
  async provisionVirtualAccount(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        email: true,
        nin: true,
        bvn: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    if (!user.email) throw new BadRequestException('Email is required');

    // ✅ Require BVN or NIN — BuyPower mandates at least one
    if (!user.bvn && !user.nin) {
      throw new BadRequestException(
        'BVN or NIN is required to provision a virtual account. Please update your profile.',
      );
    }

    // ✅ Handle null names gracefully
    const firstName =
      user.firstName ??
      user.fullName?.split(' ')[0] ??
      user.email.split('@')[0];

    const lastName =
      user.lastName ??
      user.fullName?.split(' ').slice(1).join(' ') ??
      'User';

    return this.walletService.provisionVirtualAccount({
      id: user.id,
      firstName,
      lastName,
      email: user.email,
      bvn: user.bvn ?? undefined,   
      nin: user.nin ?? undefined,   
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // POST /wallet/credit
  // ─────────────────────────────────────────────────────────────────
  @Post("credit")
  async credit(@Req() req: any, @Body() dto: CreditWalletDto) {
    const { amount } = dto;

    if (amount === undefined || isNaN(amount)) {
      throw new BadRequestException("Invalid amount");
    }

    return this.walletService.credit(
      req.user.id,
      new Prisma.Decimal(amount.toString()),
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // POST /wallet/debit
  // ─────────────────────────────────────────────────────────────────
  @Post("debit")
  async debit(
    @Req() req: any,
    @Body("amount") amount: number,
  ) {
    if (!amount || isNaN(amount)) {
      throw new BadRequestException("Invalid amount");
    }

    return this.walletService.debit(
      req.user.id,
      new Prisma.Decimal(amount.toString()),
    );
  }
}