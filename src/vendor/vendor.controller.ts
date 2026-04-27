import {
  Controller, Post, Get,
  Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { VendingService } from './vendor.service';
import { VendElectricityDto } from './dto/vend-electricity.dto';
import { VendTvDto } from './dto/vend-tv.dto';
import { VendDataDto } from './dto/vend-data.dto';

@Controller('vend')
@UseGuards(AuthGuard('jwt'))
export class VendingController {
  constructor(private readonly vendingService: VendingService) {}

  // CHECK METER
  @Get('check-meter')
  async checkMeter(
    @Query('meter') meter: string,
    @Query('disco') disco: string,
    @Query('vendType') vendType: string,
  ) {
    return this.vendingService.checkMeter(meter, disco, vendType);
  }

  // CHECK DISCO STATUS
  @Get('disco-status')
  async checkDiscoStatus() {
    return this.vendingService.checkDiscoStatus();
  }

  // VEND ELECTRICITY
  @Post('electricity')
  async vendElectricity(@Req() req: any, @Body() dto: VendElectricityDto) {
    return this.vendingService.vendElectricity(req.user.id, dto);
  }

  // VEND TV
  @Post('tv')
  async vendTv(@Req() req: any, @Body() dto: VendTvDto) {
    return this.vendingService.vendTv(req.user.id, dto);
  }

  // VEND DATA
  @Post('data')
  async vendData(@Req() req: any, @Body() dto: VendDataDto) {
    return this.vendingService.vendData(req.user.id, dto);
  }

  // RE-QUERY A TRANSACTION
  @Get('requery/:orderId')
  async reQuery(@Param('orderId') orderId: string) {
    return this.vendingService.reQuery(orderId);
  }

  // GET PRICE LIST (TV/DATA plans)
  @Get('prices')
  async getPriceList(
    @Query('vertical') vertical: string,
    @Query('disco') disco?: string,
  ) {
    return this.vendingService.getPriceList(vertical, disco);
  }

  // GET BUYPOWER WALLET BALANCE (admin)
  @Get('balance')
  async getBuyPowerBalance() {
    return this.vendingService.getBuyPowerBalance();
  }
}