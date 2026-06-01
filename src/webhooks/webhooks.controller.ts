import {
  Controller,
  Post,
  Headers,
  Body,
  RawBodyRequest,
  Req,
  HttpCode,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import * as crypto from "crypto";
import { WalletService } from "../wallet/wallet.service";

@Controller("webhooks")
export class BuypowerController {
  private readonly logger = new Logger(BuypowerController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * POST /webhooks/buypower
   *
   * Register this URL in BuyPower dashboard:
   *   Developer Tools → Webhooks → Collections
   *   → https://yourdomain.com/webhooks/buypower
   *
   * Local dev: ngrok http 3000
   *   → https://xxxx.ngrok.io/webhooks/buypower
   */
  @Post("buypower")
  @HttpCode(200)
  async handleBuypowerWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-webhook-signature") signature: string,
    @Body() payload: any,
  ) {
    this.logger.log(`BuyPower webhook received: ${JSON.stringify(payload)}`);

    // 1. Verify signature
    this.verifySignature(req.rawBody || Buffer.alloc(0), signature);

    // 2. Only process confirmed collection events
    const eventType: string = payload?.event ?? payload?.type ?? "";
    const status: string = payload?.data?.status ?? "";

    if (!this.isConfirmedCollection(eventType, status)) {
      this.logger.log(`Skipping event — type: "${eventType}", status: "${status}"`);
      return { received: true };
    }

    // 3. Extract key fields
    const data = payload.data;
    const amount: number = Number(data?.amount);
    const nuban: string = data?.nuban ?? data?.accountNumber ?? "";
    const externalRef: string =
      data?.id?.toString() ??
      data?.transactionRef ??
      data?.exchangeRef ??
      data?.reference ??
      "";

    if (!amount || !externalRef) {
      this.logger.warn("Webhook payload missing amount or reference", data);
      throw new BadRequestException("Invalid webhook payload");
    }

    // 4. Find user by NUBAN or reference (reference = user UUID)
    const reference: string = data?.reference ?? data?.exchangeRef ?? nuban;
    const user = await this.walletService.findUserByNubanOrReference(nuban, reference);

    if (!user) {
      this.logger.warn(`No user found for nuban: ${nuban} | ref: ${reference}`);
      return { received: true };
    }

    // 5. Credit wallet — idempotency handled inside creditFromWebhook
    const result = await this.walletService.creditFromWebhook(
      user.id,
      amount,
      externalRef,
      {
        description: "Wallet funding via BuyPower MFB",
        metadata: {
          sourceAccountNumber: data?.sourceAccountNumber,
          sourceAccountName: data?.sourceAccountName,
          narration: data?.narration,
          nuban,
          bankName: "BuyPower MFB",
          event: eventType,
        },
      },
    );

    if (result.duplicated) {
      this.logger.warn(`Duplicate webhook — ref: ${externalRef}`);
      return { received: true, duplicate: true };
    }

    this.logger.log(`Wallet credited — userId: ${user.id}, amount: NGN${amount}`);
    return { received: true, credited: true };
  }

  private verifySignature(rawBody: Buffer, signature: string): void {
    const webhookSecret = this.configService.get<string>("BUYPOWER_WEBHOOK_SECRET");

    if (!webhookSecret) {
      this.logger.warn("BUYPOWER_WEBHOOK_SECRET not set — skipping (dev only)");
      return;
    }

    if (!signature) {
      throw new UnauthorizedException("Missing webhook signature");
    }

    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const sigBuf = Buffer.from(signature.replace("sha256=", ""), "hex");
    const expBuf = Buffer.from(expected, "hex");

    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      this.logger.warn("Invalid webhook signature");
      throw new UnauthorizedException("Invalid webhook signature");
    }
  }

  private isConfirmedCollection(eventType: string, status: string): boolean {
    const confirmedStatuses = ["CONFIRMED", "SUCCESSFUL", "SUCCESS", "PAID"];
    return confirmedStatuses.some((s) => status?.toUpperCase().includes(s));
  }
}