import { Module } from "@nestjs/common";
import { AnalyticsService } from "./analisis.service";
import { ConsumptionController } from "./analisis.controller";
import { TransactionsModule } from "../transaction/transactions.module";

@Module({
  imports: [TransactionsModule],
  providers: [AnalyticsService],
  controllers: [ConsumptionController],
  exports: [AnalisisModule], 
})
export class AnalisisModule {} 