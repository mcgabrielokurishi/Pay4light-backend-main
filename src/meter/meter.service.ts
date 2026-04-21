
import { Injectable } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { NotFoundException } from "@nestjs/common";
import { CreateMeterDto } from "./dto/create-meter.dto";

@Injectable()
export class MeterService {
  
  constructor(private prisma: PrismaService) {}

  async createMeter(userId: string, dto: CreateMeterDto) {
  if (!userId) throw new BadRequestException('User ID missing');

  // Check user exists
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) throw new NotFoundException('User not found');

  //  Check disco exists by code
  const disco = await this.prisma.disco.findUnique({
    where: { code: dto.discoCode.toUpperCase() },
  });

  console.log('disco found:', disco); // ← check this in terminal

  if (!disco) {
    throw new NotFoundException(
      `DISCO "${dto.discoCode}" not found. Make sure the code is correct e.g IKEDC, AEDC`,
    );
  }

  if (!disco.isActive) {
    throw new BadRequestException(`DISCO "${disco.name}" is currently inactive`);
  }

  // Check meter doesn't already exist
  const existing = await this.prisma.meter.findUnique({
    where: { meterNumber: dto.meterNumber },
  });
  if (existing) throw new BadRequestException('Meter number already registered');

  // Create meter using connect
  const meter = await this.prisma.meter.create({
    data: {
      meterNumber: dto.meterNumber,
      meterType: dto.meterType,
      user: {
        connect: { id: userId },
      },
      disco: {
        connect: { code: dto.discoCode.toUpperCase() },
      },
      meterName : dto.meterName,
    },
    include: {
      disco: {
        select: {
          name: true,
          code: true,
          tariffRate: true,
          supportPhone: true,
        },
      },
    },
  });

  return {
    success: true,
    message: 'Meter added successfully',
    data: {
      meterId: meter.id,
      meterNumber: meter.meterNumber,
      meterType: meter.meterType,
      address: meter.address,
      disco: meter.disco.name,
      discoCode: meter.disco.code,
      tariffRate: meter.disco.tariffRate,
      supportPhone: meter.disco.supportPhone,
    },
  };
}
}