
import { Injectable } from "@nestjs/common";
import { MeterType } from "@prisma/client";
import { PrismaService } from "database/prisma.service";
import { NotFoundException } from "@nestjs/common";
import { CreateMeterDto } from "./dto/create-meter.dto";

@Injectable()
export class MeterService {
  constructor(private prisma: PrismaService) {}
async createMeter(userId: string, dto: CreateMeterDto) {
  //  Check user
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  //  Check disco
  const disco = await this.prisma.disco.findUnique({
  where: { code: dto.discoCode.toUpperCase() },
});

  console.log(disco)
  if (!disco) {
    throw new NotFoundException(`DISCO "${dto.discoCode}" not found`);
  }

  //  Create meter
  const meter = await this.prisma.meter.create({
    data: {
      meterNumber: dto.meterNumber,
      meterType: dto.meterType as MeterType,
      user: {
        connect: { id: userId },
      },
      disco: {
        connect: { id: dto.discoCode.toUpperCase() },
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
    },
  };
}
  
}