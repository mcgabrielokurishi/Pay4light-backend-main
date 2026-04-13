import { Module } from "@nestjs/common";
import { MeterService } from "./meter.service";
import { MeterController } from "./meter.controller";
import { PrismaModule } from "database/database.module";
import { AuthModule } from "src/auth/auth.module";

@Module({
  imports: [PrismaModule,AuthModule],
  controllers: [MeterController],
  providers: [MeterService],
})
export class MeterModule {}