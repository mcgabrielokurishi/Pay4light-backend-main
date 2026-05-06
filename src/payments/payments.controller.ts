// src/payment/payment.controller.ts
import {
  Controller, Post, Get, Delete,
  Body, Param, Query,
  UseGuards, Req, Headers,
  HttpCode, BadRequestException, Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentService } from './payments.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import * as crypto from 'crypto';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  // ─── INITIALIZE PAYMENT (get payment link) ───────────────────────
  @Post('initialize')
  @UseGuards(AuthGuard('jwt'))
  async initializePayment(
    @Req() req: any,
    @Body() dto: InitializePaymentDto,
  ) {
    return this.paymentService.initializePayment(req.user.id, dto);
  }

  // ─── VERIFY PAYMENT (after redirect from Paystack) ───────────────
  @Get('verify/:reference')
  @UseGuards(AuthGuard('jwt'))
  async verifyPayment(
    @Req() req: any,
    @Param('reference') reference: string,
  ) {
    return this.paymentService.verifyPayment(reference, req.user.id);
  }

  // ─── GET SAVED CARDS ─────────────────────────────────────────────
  @Get('cards')
  @UseGuards(AuthGuard('jwt'))
  async getSavedCards(@Req() req: any) {
    return this.paymentService.getSavedCards(req.user.id);
  }

  // ─── CHARGE SAVED CARD ───────────────────────────────────────────
  @Post('cards/:cardId/charge')
  @UseGuards(AuthGuard('jwt'))
  async chargeCard(
    @Req() req: any,
    @Param('cardId') cardId: string,
    @Body('amount') amount: number,
  ) {
    if (!amount || isNaN(amount)) {
      throw new BadRequestException('Valid amount is required');
    }
    return this.paymentService.chargeCard(req.user.id, cardId, amount);
  }

  // ─── DELETE SAVED CARD ───────────────────────────────────────────
  @Delete('cards/:cardId')
  @UseGuards(AuthGuard('jwt'))
  async deleteCard(@Req() req: any, @Param('cardId') cardId: string) {
    return this.paymentService.deleteCard(req.user.id, cardId);
  }

  // ─── PAYSTACK WEBHOOK (no auth — public) ─────────────────────────
  @Post('webhook/paystack')
  @HttpCode(200)
  async paystackWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Body() body: any,
  ) {
    // Verify signature
    const hash = crypto
      .createHmac('sha256', process.env.PAYSTACK_WEBHOOK_SECRET!)
      .update(JSON.stringify(body))
      .digest('hex');

    if (hash !== signature) {
      this.logger.error('Invalid Paystack webhook signature');
      throw new BadRequestException('Invalid signature');
    }

    return this.paymentService.handlePaystackWebhook(body);
  }
}