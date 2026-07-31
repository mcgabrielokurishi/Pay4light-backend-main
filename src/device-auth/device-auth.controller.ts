import {
  Controller, Post, Get, Delete,
  Body, Param, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DeviceAuthService } from './device-auth.service';
import {
  RegisterDeviceDto,
  SetupPinDto,
  VerifyPinDto,
  ChangeDevicePasswordDto,
  BiometricChallengeDto,
  BiometricLoginDto,
  CheckDeviceDto,
} from './dto/device-auth.dto';

@Controller('device-auth')
export class DeviceAuthController {
  constructor(private readonly deviceAuthService: DeviceAuthService) {}

  //  Check if device is registered — called on app launch (no auth)
  @Post('check')
  async checkDevice(@Body() dto: CheckDeviceDto) {
    return this.deviceAuthService.checkDevice(dto);
  }

  //  Register device — called after login/register (needs auth)
  @Post('register-device')
  @UseGuards(AuthGuard('jwt'))
  async registerDevice(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    return this.deviceAuthService.registerDevice(req.user.id, dto);
  }

  //  Setup PIN — called after device registration
  @Post('setup-pin')
  @UseGuards(AuthGuard('jwt'))
  async setupPin(@Req() req: any, @Body() dto: SetupPinDto) {
    return this.deviceAuthService.setupPin(req.user.id, dto);
  }

  //  Login with PIN — no auth needed (replaces password login)
  @Post('login-pin')
  async loginWithPin(@Body() dto: VerifyPinDto) {
    return this.deviceAuthService.loginWithPin(dto);
  }

  //  Setup biometric — saves public key from device
  @Post('setup-biometric')
  @UseGuards(AuthGuard('jwt'))
  async setupBiometric(
    @Req() req: any,
    @Body() body: { deviceId: string; publicKey: string },
  ) {
    return this.deviceAuthService.setupBiometric(req.user.id, body);
  }

  //  Get challenge for biometric login
  @Post('biometric-challenge')
  async getBiometricChallenge(@Body() dto: BiometricChallengeDto) {
    return this.deviceAuthService.getBiometricChallenge(dto);
  }

  //  Login with biometric — verifies signed challenge
  @Post('login-biometric')
  async loginWithBiometric(@Body() dto: BiometricLoginDto) {
    return this.deviceAuthService.loginWithBiometric(dto);
  }

  @Post('change-password')
@UseGuards(AuthGuard('jwt'))
async changePassword(
  @Req() req: any,
  @Body() dto: ChangeDevicePasswordDto,
) {
  return this.deviceAuthService.changePassword(req.user.id, dto);
}

  //  Get all trusted devices
  @Get('devices')
  @UseGuards(AuthGuard('jwt'))
  async getTrustedDevices(@Req() req: any) {
    return this.deviceAuthService.getTrustedDevices(req.user.id);
  }

  //  Remove/untrust a device
  @Delete('devices/:deviceId')
  @UseGuards(AuthGuard('jwt'))
  async removeDevice(@Req() req: any, @Param('deviceId') deviceId: string) {
    return this.deviceAuthService.removeDevice(req.user.id, deviceId);
  }
}