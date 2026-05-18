import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WalletModule } from 'src/wallet/wallet.module';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    WalletModule,
    PushNotificationModule,
    NotificationModule,
  ],
  controllers: [AdminController],
  providers:   [AdminService],
})
export class AdminModule {}