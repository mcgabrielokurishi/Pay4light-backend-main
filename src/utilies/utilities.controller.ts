import {
  Controller,
  Post,
  Body,
  UseGuards,
} from "@nestjs/common";
import { UtilitiesService } from "./utilities.service";
import { JwtAuthGuard } from "../common/guards/jwt.guard";
import { CurrentUser } from "../common/decorators/user.decorator";
import { ValidateMeterDto } from "./dto/validate-meter.dto";
import { PurchaseElectricityDto } from "./dto/purchase-electricity.dto";

@Controller("utilities")
@UseGuards(JwtAuthGuard)
export class UtilitiesController {
  constructor(private utilitiesService: UtilitiesService) {}

  @Post("validate-meter")
  validateMeter(@Body() dto: ValidateMeterDto) {
    return this.utilitiesService.validateMeter(
      dto.disco,
      dto.meterNumber
    );
  }

  @Post("purchase")
  purchase(
    @CurrentUser() user,
    @Body() dto: PurchaseElectricityDto
  ) {
    return this.utilitiesService.purchaseElectricity(
      user.userId,
      dto.disco,
      dto.meterNumber,
      dto.amount
    );
  }
}
