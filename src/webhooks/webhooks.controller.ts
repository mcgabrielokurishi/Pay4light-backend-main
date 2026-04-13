import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WebhookService } from './webhooks.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  // BuyPower MFB webhook → POST /webhook/buypower
  @Post('buypower')
  async handleBuypowerWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-buypower-signature') signature: string,
  ) {
    const rawBody = (req as any).rawBody;

    const isValid = this.webhookService.verifySignature(signature, rawBody);

    if (!isValid) {
      throw new BadRequestException('Invalid BuyPower signature');
    }

    const event = req.body;
    await this.webhookService.handleEvent(event);

    return res.status(HttpStatus.OK).send('Webhook received');
  }

  // Paystack webhook → POST /webhook/paystack
  @Post('paystack')
  async handlePaystackWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const rawBody = (req as any).rawBody;

    const isValid = this.webhookService.verifySignaturePayment(signature, rawBody);

    if (!isValid) {
      throw new BadRequestException('Invalid Paystack signature');
    }

    const event = req.body;
    await this.webhookService.handlePaystackEvent(event);

    return res.status(HttpStatus.OK).send('Webhook received');
  }
}