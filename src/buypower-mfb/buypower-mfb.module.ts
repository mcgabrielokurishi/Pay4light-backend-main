
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BuypowerMfbService } from './buypower-mfb.service';

@Module({
  imports:   [HttpModule, ConfigModule],
  providers: [BuypowerMfbService],
  exports:   [BuypowerMfbService],
})
export class BuypowerMfbModule {}