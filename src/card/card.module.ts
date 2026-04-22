import { Module } from "@nestjs/common";
import { CardService } from "./card.service";
import { CardController } from "./card.controller";
import { PrismaModule } from "database/database.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CardController],
  providers: [CardService],
  exports: [CardService],
})
export class CardModule {}
