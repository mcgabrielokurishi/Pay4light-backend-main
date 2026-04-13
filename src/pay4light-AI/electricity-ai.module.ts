import { Module } from "@nestjs/common";
import { AiService } from "./electricity-ai.service";
import { PrismaModule } from "database/database.module";
import { ChatMemoryModule } from "src/chat-memory/chat-memory.module";
import { UtilitiesService } from "src/utilies/utilities.service";
import { ChatMemoryService } from "./chat-memory.service";
import { VendorModule } from "src/vendor/vendor.module";
import { WalletService } from "src/wallet/wallet.service";
import { WalletModule } from "src/wallet/wallet.module";
import { AiController } from "./electricity-ai.controller";

@Module({
  imports:[
    ChatMemoryModule,
    PrismaModule,VendorModule,WalletModule
  ],
  providers: [AiService,ChatMemoryService],
  controllers: [AiController],
  exports : [AiService]
})
export class ElectricityAIModule {}
