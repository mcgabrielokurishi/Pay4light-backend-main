import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController],
  providers:   [NotificationService],
  exports:     [NotificationService], //  exported so other services can use it
})
export class NotificationModule {}