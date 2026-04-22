import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { WalletService } from "./wallet.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Prisma } from "@prisma/client";
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
  constructor(private readonly walletService: WalletService) {}

  // ─────────────────────────────────────────────────────────────────
  // GET /wallet
  // Returns wallet + virtual account details
  // ─────────────────────────────────────────────────────────────────
  @Get()
  async getWallet(@Req() req: AuthenticatedRequest) {
    return this.walletService.getWallet(req.user.id);
  }

  // ─────────────────────────────────────────────────────────────────
  // POST /wallet/provision-account
  //
  // Creates a permanent BuyPower MFB virtual account for the user.
  // Safe to call multiple times — returns existing account if already provisioned.
  // The returned NUBAN is what the user transfers money to from their bank.
  //
  // Response:
  // {
  //   "nuban": "9006346638",
  //   "bankName": "BuyPower MFB",
  //   "accountName": "John Doe",
  //   "alreadyExisted": false
  // }
  // ─────────────────────────────────────────────────────────────────
  @Post("provision-account")
  @HttpCode(HttpStatus.OK)
  async provisionAccount(@Req() req: AuthenticatedRequest) {
    const user = req.user;

    // Guard: ensure we have the fields needed to call BuyPower
    if (!user.id || !user.email || !user.firstName || !user.lastName) {
      throw new BadRequestException(
        "User profile incomplete — firstName, lastName and email are required",
      );
    }

    return this.walletService.provisionVirtualAccount({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // POST /wallet/credit  (existing)
  // ─────────────────────────────────────────────────────────────────
  @Post("credit")
  async credit(@Req() req: AuthenticatedRequest, @Body() dto: CreditWalletDto) {
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
  // POST /wallet/debit  (existing)
  // ─────────────────────────────────────────────────────────────────
  @Post("debit")
  async debit(
    @Req() req: AuthenticatedRequest,
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
