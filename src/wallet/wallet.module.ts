import { Module } from "@nestjs/common";
import { WalletService } from "./wallet.service";
import { WalletController } from "./wallet.controller";
import { PrismaModule } from "database/database.module";
import { AuthModule } from "../auth/auth.module";
import { BuypowerModule } from "../buypower/buypower.module";

@Module({
  imports: [PrismaModule, AuthModule, BuypowerModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
