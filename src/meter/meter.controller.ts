import {
  Body,
  Controller,
  Post,
  UseGuards,
  Req,
} from "@nestjs/common";
import { MeterService } from "./meter.service";
import { CreateMeterDto } from "./dto/create-meter.dto";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Meters")
@ApiBearerAuth()
@Controller("meters")
export class MeterController {
  constructor(private readonly meterService: MeterService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createMeter(@Body() dto: CreateMeterDto, @Req() req: any) {
    const userId = req.user.id;
    return this.meterService.createMeter(userId, dto);
  }
}