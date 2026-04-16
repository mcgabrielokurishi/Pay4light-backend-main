import { Module, forwardRef } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { BuypowerService } from "./buypower.service";
import { BuypowerController } from "./buypower.controller";
import { WalletModule } from "../wallet/wallet.module";

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    forwardRef(() => WalletModule), // forwardRef avoids circular dependency
  ],
  providers: [BuypowerService],
  controllers: [BuypowerController],
  exports: [BuypowerService],
})
export class BuypowerModule {}