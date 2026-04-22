import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { BankAccountService } from "./bank-account.service";
import { AddBankAccountDto } from "./dto/add-bank-account.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("bank-accounts")
@UseGuards(JwtAuthGuard)
export class BankAccountController {
  constructor(private readonly bankAccountService: BankAccountService) {}

  /**
   * GET /bank-accounts
   * Returns all saved bank accounts for the logged-in user.
   */
  @Get()
  async getAll(@Req() req: any) {
    return this.bankAccountService.getBankAccounts(req.user.id);
  }

  /**
   * POST /bank-accounts
   * Add a new bank account.
   * Body: { bankName, bankCode, accountNumber, accountName, isDefault? }
   */
  @Post()
  async add(@Req() req: any, @Body() dto: AddBankAccountDto) {
    return this.bankAccountService.addBankAccount(req.user.id, dto);
  }

  /**
   * PATCH /bank-accounts/:id/set-default
   * Set a saved bank account as the default.
   */
  @Patch(":id/set-default")
  @HttpCode(HttpStatus.OK)
  async setDefault(@Req() req: any, @Param("id") accountId: string) {
    return this.bankAccountService.setDefault(req.user.id, accountId);
  }

  /**
   * DELETE /bank-accounts/:id
   * Remove a saved bank account.
   */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(@Req() req: any, @Param("id") accountId: string) {
    return this.bankAccountService.deleteBankAccount(req.user.id, accountId);
  }
}
