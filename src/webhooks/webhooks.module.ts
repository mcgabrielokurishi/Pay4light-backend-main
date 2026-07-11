import { Module } from '@nestjs/common';
import { WebhookController } from './webhooks.controller';
import { WalletModule } from 'src/wallet/wallet.module';
import { NotificationModule } from 'src/notification/notification.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    WalletModule,
    NotificationModule,
    ConfigModule,
  ],
  controllers: [WebhookController],
})
export class WebhookModule {}