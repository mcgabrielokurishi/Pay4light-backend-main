import { Module } from '@nestjs/common';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationManagerService } from './notification-manager.service';
import { NotificationModule } from 'src/notification/notification.module';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';
import { MailModule } from 'src/common/services/mail.module';

@Module({
  imports: [
    NotificationModule,
    PushNotificationModule,
    MailModule
  ],
  controllers: [NotificationSettingsController],
  providers:   [NotificationManagerService],
  exports:     [NotificationManagerService], 
})
export class NotificationSettingsModule {}