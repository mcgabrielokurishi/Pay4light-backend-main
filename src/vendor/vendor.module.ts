import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VendingController } from './vendor.controller';
import { ConfigModule } from '@nestjs/config';
import { VendingService } from './vendor.service';
import { NotificationModule } from 'src/notification/notification.module';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    WalletModule,
    ConfigModule,
    NotificationModule
  ],
  controllers: [VendingController],
  providers: [VendingService],
  exports: [VendingService],
})
export class VendingModule {}
