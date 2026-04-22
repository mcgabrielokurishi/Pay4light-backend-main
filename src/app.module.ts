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
import { AnalisisModule } from "./analisis/analisis.module";
import { BankAccountModule } from "./bankAccount/bank-account.module";
import { CardModule } from "./card/card.module";
import { AccountModule } from "./account/account.module";
import { DiscoModule } from "./disco/disco.module";
import { BuypowerModule } from "./buypower/buypower.module";
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WalletModule,
    TransactionsModule,
    UsersModule,
    BankAccountModule,
    CardModule,
    AccountModule,
    PaymentModule,
    BuypowerModule,
    ElectricityAIModule,
    VendorModule,
    MeterModule,
    AnalisisModule,
    WebhookModule,
    DiscoModule
  ],
})
export class AppModule {}

