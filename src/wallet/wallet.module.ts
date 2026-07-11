import { Module } from "@nestjs/common";
import { WalletService } from "./wallet.service";
import { WalletController } from "./wallet.controller";
import { PrismaModule } from "database/database.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationModule } from "src/notification/notification.module";
import { MailModule } from 'src/common/services/mail.module';
import { MonnifyModule } from "src/monnify/monnify.module";
import { BuypowerModule } from "../buypower/buypower.module";
import { BuypowerMfbModule } from "src/buypower-mfb/buypower-mfb.module";
import { forwardRef } from "@nestjs/common";
import { NotificationSettingsModule } from "src/notification-settings/notification-settings.module";
import { PushNotificationModule } from "src/push-notification/push-notification.module";

@Module({
  imports: [PrismaModule,NotificationModule,NotificationSettingsModule, AuthModule,PushNotificationModule, BuypowerModule,BuypowerMfbModule,MailModule,forwardRef(() => AuthModule)],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
