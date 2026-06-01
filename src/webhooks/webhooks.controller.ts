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
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(body, null, 2));
  console.log('Signature:', signature);
  console.log('=================================');

    if (process.env.NODE_ENV === 'production' && signature) {
    const isValid = this.webhookService.verifyBuyPowerSignature(
      signature,
      JSON.stringify(body),
    );
    if (!isValid) throw new BadRequestException('Invalid signature');
  }




  return this.webhookService.handleBuyPowerEvent(body);
}
}