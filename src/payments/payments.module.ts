// src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { PaymentController } from './payments.controller';
import { PaymentService } from './payments.service';
import { WalletModule } from 'src/wallet/wallet.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [WalletModule, NotificationModule],
  controllers: [PaymentController],
  providers:   [PaymentService],
  exports:     [PaymentService],
})
export class PaymentModule {}