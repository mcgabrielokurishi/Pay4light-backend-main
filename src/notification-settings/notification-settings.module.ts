import { Module } from '@nestjs/common';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationManagerService } from './notification-manager.service';
import { NotificationModule } from 'src/notification/notification.module';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';

@Module({
  imports: [
    NotificationModule,
    PushNotificationModule,
  ],
  controllers: [NotificationSettingsController],
  providers:   [NotificationManagerService],
  exports:     [NotificationManagerService], 
})
export class NotificationSettingsModule {}