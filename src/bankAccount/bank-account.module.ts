import { Module } from "@nestjs/common";
import { BankAccountService } from "./bank-account.service";
import { BankAccountController } from "./bank-account.controller";
import { PrismaModule } from "database/database.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BankAccountController],
  providers: [BankAccountService],
  exports: [BankAccountService],
})
export class BankAccountModule {}
