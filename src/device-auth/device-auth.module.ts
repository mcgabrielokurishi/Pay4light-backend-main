import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DeviceAuthController } from './device-auth.controller';
import { DeviceAuthService } from './device-auth.service';

@Module({
  imports: [
    JwtModule.register({
      secret:      process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [DeviceAuthController],
  providers:   [DeviceAuthService],
  exports:     [DeviceAuthService],
})
export class DeviceAuthModule {}