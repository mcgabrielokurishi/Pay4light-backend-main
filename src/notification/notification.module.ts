import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PushNotificationService } from 'src/push-notification/push-notification.service';

@Module({
  controllers: [NotificationController],
  providers:   [NotificationService],
  exports:     [NotificationService,PushNotificationService] //  exported so other services can use it
})
export class NotificationModule {}