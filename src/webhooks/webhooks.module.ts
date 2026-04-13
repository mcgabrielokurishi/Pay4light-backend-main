import { Module } from '@nestjs/common';
import { WebhookController } from './webhooks.controller';
import { WebhookService } from './webhooks.service';
import { PrismaModule } from 'database/database.module';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [
    PrismaModule,   
    WalletModule,   
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
