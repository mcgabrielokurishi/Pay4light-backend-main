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
  @Req() req: any,
) {
  console.log('=== BUYPOWER WEBHOOK RECEIVED ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('Signature:', signature);
  console.log('Body:', JSON.stringify(body, null, 2));
  console.log('=================================');

  // ✅ Only check signature in production
  if (process.env.NODE_ENV === 'production') {
    const isValid = this.webhookService.verifyBuyPowerSignature(
      signature,
      JSON.stringify(body),
    );

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }
  } else {
    // Development — skip signature check
    console.log('DEV MODE — skipping signature verification');
  }

  return this.webhookService.handleBuyPowerEvent(body);
}
}