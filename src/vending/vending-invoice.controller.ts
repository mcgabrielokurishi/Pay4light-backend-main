// src/vending/vend-invoice.controller.ts
import {
  Controller, Post, Get,
  Body, Param, Query,
  Headers, UseGuards,
  Req, HttpCode, Logger,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { VendInvoiceService } from './vending-invoice.service';
import { VendElectricityLinkDto } from './dto/vend-electricity-link.dto';
import * as crypto from 'crypto';

@Controller('vend')
export class VendInvoiceController {
  private readonly logger = new Logger(VendInvoiceController.name);

  constructor(private readonly vendInvoiceService: VendInvoiceService) {}

  // ✅ Generate invoice account
  @Post('electricity-invoice')
  @UseGuards(AuthGuard('jwt'))
  async generateInvoice(
    @Req() req: any,
    @Body() dto: VendElectricityLinkDto,
  ) {
    return this.vendInvoiceService.generateInvoice(req.user.id, dto);
  }

  // ✅ Check invoice status
  @Get('invoice/:reference')
  @UseGuards(AuthGuard('jwt'))
  async checkStatus(
    @Req() req: any,
    @Param('reference') reference: string,
  ) {
    return this.vendInvoiceService.checkInvoiceStatus(reference, req.user.id);
  }

  // ✅ Get all user invoices
  @Get('invoices')
  @UseGuards(AuthGuard('jwt'))
  async getUserInvoices(
    @Req() req: any,
    @Query('page') page   = 1,
    @Query('limit') limit = 10,
  ) {
    return this.vendInvoiceService.getUserInvoices(
      req.user.id,
      Number(page),
      Number(limit),
    );
  }

  // ✅ BuyPower MFB webhook — no auth
  @Post('webhook/buypower-mfb')
  @HttpCode(200)
  async buypowerWebhook(
    @Headers('x-webhook-signature') signature: string,
    @Body() body: any,
  ) {
    this.logger.log('=== BUYPOWER MFB WEBHOOK RECEIVED ===');
    this.logger.log(JSON.stringify(body, null, 2));

    // Verify signature
    const secret      = process.env.BUYPOWER_WEBHOOK_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && secret && signature) {
      const hash = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');

      if (hash !== signature) {
        this.logger.error('Invalid BuyPower MFB signature');
        throw new BadRequestException('Invalid signature');
      }
    }

    return this.vendInvoiceService.handleBuypowerWebhook(body);
  }
}