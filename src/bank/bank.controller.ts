import { Controller, Get, Param, Query } from '@nestjs/common';
import { BankService } from './bank.service';
import { BankQueryDto } from './dto/bank.dto';


@Controller('account-information')
export class BankController {
  constructor(private readonly bankService: BankService) {}

  // GET ALL BANKS
  @Get('banks')
  getAllBanks(@Query() query: BankQueryDto) {
    const banks = this.bankService.getAllBanks(query.search);
    return {
      success: true,
      message: 'Nigerian banks retrieved successfully',
      total: banks.length,
      data: banks,
    };
  }

  // GET BANK BY CODE
  @Get('banks/code/:code')
  getBankByCode(@Param('code') code: string) {
    const bank = this.bankService.getBankByCode(code);
    return {
      success: true,
      message: 'Bank retrieved successfully',
      data: bank,
    };
  }

  // GET BANK BY SLUG
  @Get('banks/slug/:slug')
  getBankBySlug(@Param('slug') slug: string) {
    const bank = this.bankService.getBankBySlug(slug);
    return {
      success: true,
      message: 'Bank retrieved successfully',
      data: bank,
    };
  }
}