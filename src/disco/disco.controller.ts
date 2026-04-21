// src/disco/disco.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { DiscoService } from './disco.service';
import { DiscoDto } from './dto/dto.disco';
import { QueryDiscoDto } from './dto/get-disco';


// src/disco/disco.controller.ts
@Controller('disco')
export class DiscoController {
  constructor(private readonly discoService: DiscoService) {}

  //  POST select — must be before :code
  @Post('select')
  @UseGuards(AuthGuard('jwt'))
  async selectDisco(@Req() req: any, @Body() dto: DiscoDto) {
    const result = await this.discoService.selectUserDisco(req.user.id, dto);
    return {
      success: true,
      message: `You have selected ${result.disco.name} as your DISCO`,
      data: result,
    };
  }

  //  GET my-disco — must be before :code
  @Get('my-disco')
  @UseGuards(AuthGuard('jwt'))
  async getUserDisco(@Req() req: any) {
    const result = await this.discoService.getUserDisco(req.user.id);
    return {
      success: true,
      message: 'Your DISCO retrieved successfully',
      data: result,
    };
  }

  //  GET all — no param
  @Get()
  async getAllDiscos(@Query() query: QueryDiscoDto) {
    const discos = await this.discoService.getAllDiscos(query);
    return {
      success: true,
      message: 'DISCOs retrieved successfully',
      total: discos.length,
      data: discos,
    };
  }

  //  GET by state — must be before :code
  @Get('state/:state')
  async getDiscosByState(@Param('state') state: string) {
    const discos = await this.discoService.getDiscosByState(state);
    return {
      success: true,
      message: `DISCOs retrieved successfully`,
      total: discos.length,
      data: discos,
    };
  }

  //  :code — ALWAYS LAST
  @Get(':code')
  async getDiscoByCode(@Param('code') code: string) {
    const disco = await this.discoService.getDiscoByCode(code);
    return {
      success: true,
      message: 'DISCO retrieved successfully',
      data: disco,
    };
  }
}