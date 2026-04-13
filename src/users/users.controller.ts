import { Controller, Get, Patch, Body, Req, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../common/guards/jwt.guard";
import { UpdateUserDto } from "./dto/update-user.dto";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("userprofile")
  getProfile(@Req() req) {
    return this.usersService.getMe(req.user.userId);
  }

  @Patch("updateprofile")
  updateProfile(@Req() req, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }
}