
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MonnifyService } from './monnify.service';

@Module({
  imports:   [HttpModule, ConfigModule],
  providers: [MonnifyService],
  exports:   [MonnifyService],
})
export class MonnifyModule {}