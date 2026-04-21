// src/disco/disco.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { QueryDiscoDto } from './dto/get-disco';
import { DiscoDto } from './dto/dto.disco';

@Injectable()
export class DiscoService {
  constructor(private readonly prisma: PrismaService) {}

  // SELECT USER DISCO
  async selectUserDisco(userId: string, dto: DiscoDto) {
    const disco = await this.prisma.disco.findUnique({
      where: { code: dto.discoCode.toUpperCase() },
    });

    if (!disco) {
      throw new NotFoundException(`DISCO "${dto.discoCode}" not found`);
    }

    if (!disco.isActive) {
      throw new BadRequestException(
        `DISCO "${disco.name}" is currently unavailable`,
      );
    }

    //  Save discoId to user — now works since schema is updated
    await this.prisma.user.update({
      where: { id: userId },
      data: { discoId: disco.id },
    });

    // Return disco separately — no more 'never' error
    return {
      discoId: disco.id,
      disco: {
        name: disco.name,
        code: disco.code,
        tariffRate: disco.tariffRate,
        supportPhone: disco.supportPhone,
        states: disco.states,
      },
    };
  }

  // GET ALL DISCOs
  async getAllDiscos(query: QueryDiscoDto) {
    const { state, search, isActive } = query;

    const discos = await this.prisma.disco.findMany({
      where: {
        isActive: isActive !== undefined ? isActive : true,
        // ✅ Fix: removed mode: 'insensitive' — use contains only
        ...(state ? { states: { contains: state } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { code: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        states: true,
        tariffRate: true,
        supportPhone: true,
        supportEmail: true,
        website: true,
        isActive: true,
      },
    });

    return discos;
  }

  // GET SINGLE DISCO BY CODE
  async getDiscoByCode(code: string) {
    const disco = await this.prisma.disco.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!disco) {
      throw new NotFoundException(`DISCO with code ${code} not found`);
    }

    return disco;
  }

  // GET DISCOs BY STATE
  async getDiscosByState(state: string) {
    // Fix: removed mode: 'insensitive'
    const discos = await this.prisma.disco.findMany({
      where: {
        isActive: true,
        states: { contains: state },
      },
      orderBy: { name: 'asc' },
    });

    if (!discos.length) {
      throw new NotFoundException(`No DISCOs found for state: ${state}`);
    }

    return discos;
  }

  // GET USER'S DISCO
  async getUserDisco(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        disco: true,
      },
    });

    if (!user?.disco) {
      throw new NotFoundException(
        'You have not selected a DISCO yet. Please select one.',
      );
    }

    return {
      disco: user.disco,
    };
  }
}