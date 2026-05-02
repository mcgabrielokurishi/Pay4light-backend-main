// src/webhook/webhook.module.ts
import { Module } from '@nestjs/common';
import { WebhookController } from './webhooks.controller';
import { WebhookService } from './webhooks.service';
import { WalletModule } from 'src/wallet/wallet.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    WalletModule,
    NotificationModule,
  ],
  controllers: [WebhookController],
  providers:   [WebhookService],
})
export class WebhookModule {}