import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles } from "src/common/decorators/roles.decorators";
import { JwtAuthGuard } from "src/common/guards/jwt.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { AdminService } from "./admin.service";


@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get("stats")
  getStats() {
    return this.adminService.getDashboardStats();
  }
}
