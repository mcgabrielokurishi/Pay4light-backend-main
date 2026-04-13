
import {
  Body,
  Controller,
  Post,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { InitializePaymentDto } from "./dto/initialize-payment.dto";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { WebhookService } from "src/webhooks/webhooks.service";

@ApiTags("Payments")
@ApiBearerAuth()
@Controller("payments")
export class PaymentsController {
  WebhookService: any;
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post("initialize")
  initialize(@Body() dto: InitializePaymentDto, @Req() req: any) {
    const userId = req.user.userId;
    return this.paymentsService.initializePayment(userId, dto);
  }
   @Post("paystack")
handlePaystackWebhook(@Req() req: any) {
  return this.WebhookService.handlePaystack(req.body);
}

}