// src/information/information.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InformationService } from './information.service';
import { CreateInformationDto, UpdateInformationDto } from './dto/create-information.dto';
import { InfoCategory } from '@prisma/client';

@Controller('information')
export class InformationController {
  constructor(private readonly informationService: InformationService) {}

  // ─── USER ROUTES (public/authenticated) ────────────────────────

  // GET ALL PUBLISHED INFO
  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getPublished(@Query('category') category?: InfoCategory) {
    const data = await this.informationService.getPublished(category);
    return {
      success: true,
      message: 'Information retrieved successfully',
      total:   data.length,
      data,
    };
  }

  // GET ONE INFO
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async getOne(@Param('id') id: string) {
    const data = await this.informationService.getOne(id);
    return { success: true, data };
  }

  // ─── ADMIN ROUTES ───────────────────────────────────────────────

  // CREATE INFO (admin only)
  @Post('admin')
  @UseGuards(AuthGuard('jwt'))
  async create(@Req() req: any, @Body() dto: CreateInformationDto) {
    // ✅ Check admin role
    if (req.user.role !== 'ADMIN') {
      throw new Error('Access denied — admins only');
    }
    const data = await this.informationService.create(req.user.id, dto);
    return { success: true, message: 'Information created', data };
  }

  // UPDATE INFO (admin only)
  @Patch('admin/:id')
  @UseGuards(AuthGuard('jwt'))
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateInformationDto,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new Error('Access denied — admins only');
    }
    const data = await this.informationService.update(id, req.user.id, dto);
    return { success: true, message: 'Information updated', data };
  }

  // DELETE INFO (admin only)
  @Delete('admin/:id')
  @UseGuards(AuthGuard('jwt'))
  async delete(@Req() req: any, @Param('id') id: string) {
    if (req.user.role !== 'ADMIN') {
      throw new Error('Access denied — admins only');
    }
    await this.informationService.delete(id);
    return { success: true, message: 'Information deleted' };
  }

  // GET ALL INCLUDING UNPUBLISHED (admin only)
  @Get('admin/all')
  @UseGuards(AuthGuard('jwt'))
  async getAllAdmin(
    @Req() req: any,
    @Query('category') category?: InfoCategory,
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new Error('Access denied — admins only');
    }
    const data = await this.informationService.getAllAdmin(category);
    return { success: true, total: data.length, data };
  }
}