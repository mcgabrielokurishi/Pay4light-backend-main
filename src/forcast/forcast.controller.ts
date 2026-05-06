// src/forecast/forecast.controller.ts
import {
  Controller, Get, Post,
  Param, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ForecastService } from './forcast.service';

@Controller('forecast')
@UseGuards(AuthGuard('jwt'))
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  // GET all meters forecast for logged in user
  @Get()
  async getUserForecast(@Req() req: any) {
    const data = await this.forecastService.getUserForecast(req.user.id);
    return {
      success: true,
      message: 'Forecast retrieved successfully',
      total:   data.length,
      data,
    };
  }

  // GET forecast for one specific meter
  @Get('meter/:meterId')
  async getMeterForecast(
    @Req() req: any,
    @Param('meterId') meterId: string,
  ) {
    const data = await this.forecastService.getMeterForecast(
      req.user.id,
      meterId,
    );
    return {
      success: true,
      data,
    };
  }

  // GET usage history for one meter
  @Get('meter/:meterId/history')
  async getMeterUsageHistory(
    @Req() req: any,
    @Param('meterId') meterId: string,
  ) {
    const data = await this.forecastService.getMeterUsageHistory(
      req.user.id,
      meterId,
    );
    return {
      success: true,
      total:   data.length,
      data,
    };
  }

  // Manually trigger forecast for one meter (refresh)
  @Post('meter/:meterId/refresh')
  async refreshMeterForecast(
    @Req() req: any,
    @Param('meterId') meterId: string,
  ) {
    const data = await this.forecastService.getMeterForecast(
      req.user.id,
      meterId,
    );
    return {
      success: true,
      message: 'Forecast refreshed',
      data,
    };
  }

  // Admin — trigger full forecast run
  @Post('admin/trigger')
  async triggerManualForecast(@Req() req: any) {
    if (req.user.role !== 'ADMIN') {
      return { success: false, message: 'Admins only' };
    }
    return this.forecastService.triggerManualForecast();
  }
}