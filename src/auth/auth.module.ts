import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { AuthService } from "./auth.service";
import { PushNotificationModule } from "src/push-notification/push-notification.module";
import { OtpModule } from "./OTP/otp.module";
import { WalletModule } from "src/wallet/wallet.module";
import { forwardRef } from "@nestjs/common";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: "1h" },
    }),
    OtpModule,
    PushNotificationModule,
    forwardRef(() => WalletModule)
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
