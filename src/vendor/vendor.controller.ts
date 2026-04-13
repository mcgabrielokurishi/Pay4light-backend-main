import { Controller, Post, Body, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { VendorService } from "./vendor.service";
import { VendElectricityDto } from "./dto/vend-electricity.dto";

@Controller("vendor")
@UseGuards(JwtAuthGuard)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post("electricity")
  async vendElectricity(@Req() req: Request, @Body() dto: VendElectricityDto) {
    return this.vendorService.vendElectricity((req as any).user.userId, dto);
  }
}