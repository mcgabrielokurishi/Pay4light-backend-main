import { Module } from "@nestjs/common";
import { PrismaModule } from "database/database.module";
import { WalletModule } from "./wallet/wallet.module";
import { AuthModule } from "./auth/auth.module";
import { ElectricityAIModule } from "./pay4light-AI/electricity-ai.module";
import { VendorModule } from "./vendor/vendor.module";
import { UsersModule } from "./users/users.module";
import { MeterModule } from "./meter/meter.module";
import { PaymentModule } from "./payments/payments.module";
import { WebhookModule } from "./webhooks/webhooks.module";
import { TransactionsModule } from "./transaction/transactions.module";
import { analisismodule } from "./analisis/analisis.module";
import { DiscoModule } from "./disco/disco.module";
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WalletModule,
    TransactionsModule,
    UsersModule,
    PaymentModule,
    ElectricityAIModule,
    VendorModule,
    MeterModule,
    analisismodule,
    WebhookModule,
    DiscoModule
  ],
})
export class AppModule {}

