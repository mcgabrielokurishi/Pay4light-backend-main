import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VendingController } from './vendor.controller';
import { ConfigModule } from '@nestjs/config';
import { VendingService } from './vendor.service';
import { VendInvoiceService } from 'src/vending/vending-invoice.service';
import { VendInvoiceController } from 'src/vending/vending-invoice.controller';
import { BuypowerMfbModule } from 'src/buypower-mfb/buypower-mfb.module';
import { NotificationModule } from 'src/notification/notification.module';
import { MailModule } from 'src/common/services/mail.module';
import { NotificationSettingsModule } from 'src/notification-settings/notification-settings.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    WalletModule,
    PushNotificationModule,
    ConfigModule,
    NotificationModule,
    NotificationSettingsModule,
    BuypowerMfbModule,
    MailModule,
  ],
  controllers: [VendingController,VendInvoiceController],
  providers: [VendingService,VendInvoiceService],
  exports: [VendingService,VendInvoiceService],
})
export class VendingModule {}
