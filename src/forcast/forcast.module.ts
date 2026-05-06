import { Module } from '@nestjs/common';
import { ForecastController } from './forcast.controller';
import { ForecastService } from './forcast.service';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';
import { NotificationModule } from 'src/notification/notification.module';
import { VendingModule } from 'src/vendor/vendor.module';

@Module({
  imports: [
    PushNotificationModule,
    NotificationModule,
    VendingModule,

  ],
  controllers: [ForecastController],
  providers:   [ForecastService],
  exports:     [ForecastService],
})
export class ForecastModule {}