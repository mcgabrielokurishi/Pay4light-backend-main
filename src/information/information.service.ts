// src/information/information.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { InfoCategory } from '@prisma/client';
import { CreateInformationDto, UpdateInformationDto } from './dto/create-information.dto';

@Injectable()
export class InformationService {
  constructor(private readonly prisma: PrismaService) {}

  // ADMIN — CREATE INFO
  async create(adminId: string, dto: CreateInformationDto) {
    return this.prisma.information.create({
      data: {
        title:       dto.title,
        content:     dto.content,
        category:    dto.category   ?? InfoCategory.GENERAL,
        isPublished: dto.isPublished ?? true,
        createdBy:   adminId,
      },
    });
  }

  // ADMIN — UPDATE INFO
  async update(id: string, adminId: string, dto: UpdateInformationDto) {
    const info = await this.prisma.information.findUnique({ where: { id } });
    if (!info) throw new NotFoundException('Information not found');

    return this.prisma.information.update({
      where: { id },
      data:  dto,
    });
  }

  // ADMIN — DELETE INFO
  async delete(id: string) {
    const info = await this.prisma.information.findUnique({ where: { id } });
    if (!info) throw new NotFoundException('Information not found');

    return this.prisma.information.delete({ where: { id } });
  }

  // ADMIN — GET ALL (including unpublished)
  async getAllAdmin(category?: InfoCategory) {
    return this.prisma.information.findMany({
      where: { ...(category ? { category } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  // USER — GET ALL PUBLISHED
  async getPublished(category?: InfoCategory) {
    return this.prisma.information.findMany({
      where: {
        isPublished: true,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id:        true,
        title:     true,
        content:   true,
        category:  true,
        createdAt: true,
      },
    });
  }

  // USER — GET ONE
  async getOne(id: string) {
    const info = await this.prisma.information.findFirst({
      where: { id, isPublished: true },
    });

    if (!info) throw new NotFoundException('Information not found');
    return info;
  }
}