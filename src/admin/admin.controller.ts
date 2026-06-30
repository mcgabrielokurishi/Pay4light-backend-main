import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from './guard/admin.guard';
import { AdminService } from './admin.service';
import {
  GetUsersDto,
  UpdateUserRoleDto,
  AdjustWalletDto,
  BroadcastDto,
  LockWalletDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), AdminGuard) // both guards on all routes
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  //  DASHBOARD 

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('overview')
  async getOverview() {
    return this.adminService.getSystemOverview();
  }

  //  USERS 

  @Get('users')
  async getAllUsers(@Query() query: GetUsersDto) {
    const result = await this.adminService.getAllUsers(query);
    return { success: true, ...result };
  }

  @Get('users/:userId')
  async getUser(@Param('userId') userId: string) {
    const data = await this.adminService.getUser(userId);
    return { success: true, data };
  }

  @Patch('users/:userId/lock')
  async lockUser(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body('lock') lock: boolean,
  ) {
    return this.adminService.toggleUserLock(req.user.id, userId, lock);
  }

  @Patch('users/:userId/active')
  async toggleActive(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.adminService.toggleUserActive(req.user.id, userId, isActive);
  }

  @Patch('users/:userId/role')
  async updateRole(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(req.user.id, userId, dto.role);
  }

  @Delete('users/:userId')
  async forceDeleteUser(
    @Req() req: any,
    @Param('userId') userId: string,
  ) {
    return this.adminService.forceDeleteUser(req.user.id, userId);
  }

  //  WALLETS 

  @Patch('users/:userId/wallet/lock')
  async lockWallet(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() dto: LockWalletDto,
  ) {
    return this.adminService.toggleWalletLock(req.user.id, userId, dto);
  }

  @Post('users/:userId/wallet/adjust')
  async adjustWallet(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() dto: AdjustWalletDto,
  ) {
    return this.adminService.adjustWalletBalance(req.user.id, userId, dto);
  }

  //  TRANSACTIONS 

  @Get('transactions')
  async getAllTransactions(
    @Query('page') page   = 1,
    @Query('limit') limit = 20,
    @Query('userId') userId?: string,
  ) {
    const result = await this.adminService.getAllTransactions(
      Number(page),
      Number(limit),
      userId,
    );
    return { success: true, ...result };
  }

  @Get('vendor-transactions')
  async getAllVendorTransactions(
    @Query('page') page     = 1,
    @Query('limit') limit   = 20,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    const result = await this.adminService.getAllVendorTransactions(
      Number(page),
      Number(limit),
      status,
      userId,
    );
    return { success: true, ...result };
  }

  //  BROADCAST 

  @Post('broadcast')
  async broadcast(@Req() req: any, @Body() dto: BroadcastDto) {
    return this.adminService.broadcastNotification(req.user.id, dto);
  }
}