import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';

@Module({
  imports: [PushNotificationModule], 
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}