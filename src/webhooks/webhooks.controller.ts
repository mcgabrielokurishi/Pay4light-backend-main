// src/webhook/webhook.controller.ts
import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  RawBodyRequest,
  HttpCode,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhookService } from './webhooks.service';
import * as crypto from 'crypto';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('buypower')
  @HttpCode(200)
  async handleBuyPower(
    @Headers('x-payable-signature') signature: string,
    @Body() body: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log('BuyPower webhook received');
    this.logger.log('Webhook body:', JSON.stringify(body, null, 2));

    // ✅ Verify signature
    const rawBody = JSON.stringify(body);
    const isValid = this.webhookService.verifyBuyPowerSignature(
      signature,
      rawBody,
    );

    if (!isValid) {
      this.logger.error('Invalid BuyPower webhook signature');
      throw new BadRequestException('Invalid signature');
    }

    return this.webhookService.handleBuyPowerEvent(body);
  }
}