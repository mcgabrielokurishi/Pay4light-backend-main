import { Controller, Get, Patch, Body, Req, UseGuards, BadRequestException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../common/guards/jwt.guard";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AuthGuard } from "@nestjs/passport";


@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("userprofile")
  getProfile(@Req() req) {
    return this.usersService.getMe(req.user.id);
  }

 @Patch('updateprofile')
@UseGuards(AuthGuard('jwt'))
async updateProfile(@Req() req: any, @Body() dto: UpdateUserDto) {
  //  Log to confirm id is present
  console.log('Update profile — req.user:', req.user);

  const userId = req.user?.id || req.user?.sub;

  if (!userId) {
    throw new BadRequestException('User not authenticated');
  }

  return this.usersService.updateProfile(userId, dto);
}
}
