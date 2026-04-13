// src/disco/disco.controller.ts
import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Body,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DiscoService } from './disco.service';
import { DiscoDto } from './dto/dto.disco';
import { QueryDiscoDto } from './dto/get-disco';
import { Request } from 'express';

@Controller('disco')
export class DiscoController {
  constructor(private readonly discoService: DiscoService) {}

@Post('select')
  @UseGuards(AuthGuard('jwt'))
  async selectDisco(
    @Req() req:any,                   
    @Body() dto: DiscoDto,
  ) 
  
  {
    console.log('Full req.user:', req.user); 
  console.log('user id:', req.user?.id);
  console.log('user sub:', req.user?.sub);

    const result = await this.discoService.selectUserDisco(
      (req.user as any).id,
      dto,
    );

    return {
      success: true,
      message: `You have selected ${result.disco.name } as your DISCO`,
      data: result,
    };
  }
  // GET ALL DISCOs — public
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

  // GET DISCOs BY STATE — public
  @Get('state/:state')
  async getDiscosByState(@Param('state') state: string) {
    const discos = await this.discoService.getDiscosByState(state);
    return {
      success: true,
      message: `DISCOs for ${state} retrieved successfully`,
      total: discos.length,
      data: discos,
    };
  }

  // GET USER'S DISCO — protected
  @Get('my-disco')
  @UseGuards(AuthGuard('jwt'))
  async getUserDisco(@Req() req:any) {
    const result = await this.discoService.getUserDisco(req.user.id);
    return {
      success: true,
      message: 'Your DISCO information retrieved successfully',
      data: result,
    };
  }

  // GET SINGLE DISCO BY CODE — public
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