// src/requery/requery.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RequeryController } from './requery.controller';
import { RequeryService } from './requery.service';
import { WalletModule } from 'src/wallet/wallet.module';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    WalletModule,
    PushNotificationModule,
    NotificationModule,
  ],
  controllers: [RequeryController],
  providers:   [RequeryService],
  exports:     [RequeryService],
})
export class RequeryModule {}