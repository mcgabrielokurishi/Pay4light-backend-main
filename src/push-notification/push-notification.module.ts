import { Module } from '@nestjs/common';
import { PushNotificationController } from './push-notification.controller';
import { PushNotificationService } from './push-notification.service';
import { FirebaseService } from './firebase.service';

@Module({
  controllers: [PushNotificationController],
  providers:   [PushNotificationService, FirebaseService],
  exports:     [PushNotificationService], 
})
export class PushNotificationModule {}