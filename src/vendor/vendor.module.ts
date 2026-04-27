import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VendingController } from './vendor.controller';
import { VendingService } from './vendor.service';
import { ConfigModule } from '@nestjs/config';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [
    HttpModule,
    WalletModule,
    ConfigModule
  ],
  controllers: [VendingController],
  providers: [VendingService],
  exports: [VendingService],
})
export class VendingModule {}
