import { Module } from "@nestjs/common";
import { WalletService } from "./wallet.service";
import { WalletController } from "./wallet.controller";
import { PrismaModule } from "database/database.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationModule } from "src/notification/notification.module";
import { BuypowerModule } from "../buypower/buypower.module";
import { forwardRef } from "@nestjs/common";
import { PushNotificationModule } from "src/push-notification/push-notification.module";

@Module({
  imports: [PrismaModule,NotificationModule, AuthModule,PushNotificationModule, BuypowerModule,forwardRef(() => AuthModule)],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
