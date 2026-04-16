import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { Request } from "express";
import { WalletService } from "./wallet.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Prisma } from "@prisma/client";
import { CreditWalletDto } from "./dto/credit.dto";

type AuthenticatedRequest = Request & { user: { userId: string } };

@Controller("wallet")
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // GET WALLET
  @Get()
  async getWallet(@Req() req: any) {
    return this.walletService.getWallet(req.user.id);
  }

@Post("credit")
  async credit(
    @Req() req: any,
    @Body() dto: CreditWalletDto
  ) {
    const { amount } = dto;

    // Extra safety (optional but good)
    if (amount === undefined || isNaN(amount)) {
      throw new BadRequestException("Invalid amount");
    }

    const decimalAmount = new Prisma.Decimal(amount.toString());

    return this.walletService.credit(req.user.id, decimalAmount);
  }

  // DEBIT WALLET
  @Post("debit")
  async debit(
    @Req() req: AuthenticatedRequest,
    @Body("amount") amount: number
  ) {
    return this.walletService.debit(
      req.user.userId,
      new Prisma.Decimal(amount)
    );
  }
}