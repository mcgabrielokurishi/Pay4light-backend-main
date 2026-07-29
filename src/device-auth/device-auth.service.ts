import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import {
  RegisterDeviceDto,
  SetupPinDto,
  VerifyPinDto,
  BiometricChallengeDto,
  BiometricLoginDto,
  CheckDeviceDto,
} from './dto/device-auth.dto';

// Store challenges temporarily in memory (expires in 2 minutes)
const challengeStore = new Map<string, {
  challenge: string;
  userId:    string;
  expiresAt: Date;
}>();

@Injectable()
export class DeviceAuthService {
  private readonly logger = new Logger(DeviceAuthService.name);

  constructor(
    private readonly prisma:      PrismaService,
    private readonly jwtService:  JwtService,
  ) {}

  // ─── CHECK IF DEVICE IS REGISTERED 
  // Frontend calls this on app launch to decide which screen to show
  async checkDevice(dto: CheckDeviceDto) {
    const device = await this.prisma.device.findUnique({
      where:   { deviceId: dto.deviceId },
      include: {
        user: {
          select: {
            id:        true,
            fullName:  true,
            firstName: true,
            email:     true,
          },
        },
      },
    });

    if (!device || !device.isTrusted) {
      return {
        isRegistered:    false,
        hasPin:          false,
        hasBiometric:    false,
        // ← frontend shows Login/Register screen
      };
    }

    return {
      isRegistered:  true,
      hasPin:        !!device.pinHash,
      hasBiometric:  !!device.biometricKey,
      user: {
        id:       device.user.id,
        fullName: device.user.fullName || device.user.firstName,
        email:    device.user.email,
      },
      // ← frontend shows PIN/Biometric screen
    };
  }

  // ─── REGISTER DEVICE (called after successful login/register) ────
  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    // Check if device already registered
    const existing = await this.prisma.device.findUnique({
      where: { deviceId: dto.deviceId },
    });

    if (existing) {
      // Update existing device — re-link to this user
      const updated = await this.prisma.device.update({
        where: { deviceId: dto.deviceId },
        data: {
          userId,
          deviceName: dto.deviceName,
          platform:   dto.platform,
          isTrusted:  true,
          lastUsedAt: new Date(),
        },
      });
      return {
        success:  true,
        message:  'Device registered successfully',
        deviceId: updated.deviceId,
      };
    }

    // Register new device
    const device = await this.prisma.device.create({
      data: {
        userId,
        deviceId:   dto.deviceId,
        deviceName: dto.deviceName,
        platform:   dto.platform,
        isTrusted:  true,
      },
    });

    this.logger.log(`Device registered — userId: ${userId}, deviceId: ${dto.deviceId}`);

    return {
      success:  true,
      message:  'Device registered successfully',
      deviceId: device.deviceId,
    };
  }

  // ─── SETUP PIN ───────────────────────────────────────────────────
  async setupPin(userId: string, dto: SetupPinDto) {
    // Validate PIN is numeric
    if (!/^\d{4,6}$/.test(dto.pin)) {
      throw new BadRequestException('PIN must be 4-6 numeric digits');
    }

    const device = await this.prisma.device.findFirst({
      where: { deviceId: dto.deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('Device not registered. Please register device first.');
    }

    // Hash the PIN
    const pinHash = await bcrypt.hash(dto.pin, 12);

    await this.prisma.device.update({
      where: { deviceId: dto.deviceId },
      data:  { pinHash },
    });

    this.logger.log(`PIN set up — userId: ${userId}, deviceId: ${dto.deviceId}`);

    return {
      success: true,
      message: 'PIN set up successfully',
    };
  }

  // ─── LOGIN WITH PIN ──────────────────────────────────────────────
  async loginWithPin(dto: VerifyPinDto) {
    const device = await this.prisma.device.findUnique({
      where:   { deviceId: dto.deviceId },
      include: { user: true },
    });

    if (!device || !device.isTrusted) {
      throw new UnauthorizedException('Device not recognized. Please log in with your password.');
    }

    if (!device.pinHash) {
      throw new BadRequestException('PIN not set up on this device.');
    }

    // Verify PIN
    const isValid = await bcrypt.compare(dto.pin, device.pinHash);
    if (!isValid) {
      throw new UnauthorizedException('Incorrect PIN. Please try again.');
    }

    const user = device.user;

    if (!user.isVerified) {
      throw new UnauthorizedException('Account not verified.');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('Account is deactivated.');
    }

    // Update last used
    await this.prisma.device.update({
      where: { deviceId: dto.deviceId },
      data:  { lastUsedAt: new Date() },
    });

    this.logger.log(`PIN login success — userId: ${user.id}`);

    // Generate fresh tokens
    return this.generateTokens(user.id, user.email ?? user.phone!);
  }

  // ─── BIOMETRIC — GET CHALLENGE ───────────────────────────────────
  // Frontend calls this to get a challenge to sign with biometric
  async getBiometricChallenge(dto: BiometricChallengeDto) {
    const device = await this.prisma.device.findUnique({
      where: { deviceId: dto.deviceId },
    });

    if (!device || !device.isTrusted) {
      throw new UnauthorizedException('Device not recognized.');
    }

    if (!device.biometricKey) {
      throw new BadRequestException('Biometric not set up on this device.');
    }

    // Generate a random challenge
    const challenge   = crypto.randomBytes(32).toString('hex');
    const expiresAt   = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    challengeStore.set(dto.deviceId, {
      challenge,
      userId: device.userId,
      expiresAt,
    });

    return {
      success:   true,
      challenge, // frontend signs this with biometric private key
    };
  }

  // ─── BIOMETRIC — REGISTER PUBLIC KEY
  async setupBiometric(userId: string, dto: { deviceId: string; publicKey: string }) {
    const device = await this.prisma.device.findFirst({
      where: { deviceId: dto.deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('Device not registered.');
    }

    await this.prisma.device.update({
      where: { deviceId: dto.deviceId },
      data:  { biometricKey: dto.publicKey },
    });

    return {
      success: true,
      message: 'Biometric authentication enabled',
    };
  }

  // ─── BIOMETRIC LOGIN 
  async loginWithBiometric(dto: BiometricLoginDto) {
    const device = await this.prisma.device.findUnique({
      where:   { deviceId: dto.deviceId },
      include: { user: true },
    });

    if (!device || !device.isTrusted || !device.biometricKey) {
      throw new UnauthorizedException('Biometric not set up on this device.');
    }

    // Get stored challenge
    const stored = challengeStore.get(dto.deviceId);
    if (!stored) {
      throw new UnauthorizedException('Challenge expired. Please try again.');
    }

    if (new Date() > stored.expiresAt) {
      challengeStore.delete(dto.deviceId);
      throw new UnauthorizedException('Challenge expired. Please try again.');
    }

    // Verify signature using stored public key
    try {
      const verify    = crypto.createVerify('SHA256');
      verify.update(stored.challenge);
      const isValid   = verify.verify(device.biometricKey, dto.signature, 'hex');

      if (!isValid) {
        throw new UnauthorizedException('Biometric verification failed.');
      }
    } catch (error) {
      throw new UnauthorizedException('Biometric verification failed.');
    }

    // Clean up challenge
    challengeStore.delete(dto.deviceId);

    const user = device.user;

    await this.prisma.device.update({
      where: { deviceId: dto.deviceId },
      data:  { lastUsedAt: new Date() },
    });

    this.logger.log(`Biometric login success — userId: ${user.id}`);

    return this.generateTokens(user.id, user.email ?? user.phone!);
  }

  // ─── REMOVE DEVICE (logout from this device) ────────────────────
  async removeDevice(userId: string, deviceId: string) {
    await this.prisma.device.updateMany({
      where: { deviceId, userId },
      data:  { isTrusted: false, pinHash: null, biometricKey: null },
    });

    return {
      success: true,
      message: 'Device removed. You will need to log in with your password next time.',
    };
  }

  // ─── GET ALL TRUSTED DEVICES 
  async getTrustedDevices(userId: string) {
    const devices = await this.prisma.device.findMany({
      where:   { userId, isTrusted: true },
      select: {
        deviceId:   true,
        deviceName: true,
        platform:   true,
        hasPin:     false,
        lastUsedAt: true,
        createdAt:  true,
      },
    });

    return {
      success: true,
      data:    devices.map((d) => ({
        deviceId:   d.deviceId,
        deviceName: d.deviceName,
        platform:   d.platform,
        lastUsedAt: d.lastUsedAt,
        createdAt:  d.createdAt,
      })),
    };
  }

  // ─── GENERATE TOKENS 
  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret:    process.env.JWT_SECRET,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret:    process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return {
      success:      true,
      accessToken,
      refreshToken,
      message:      'Login successful',
    };
  }
}