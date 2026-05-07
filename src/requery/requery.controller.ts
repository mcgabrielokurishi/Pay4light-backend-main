// src/requery/requery.controller.ts
import {
  Controller, Get, Post,
  Param, UseGuards, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequeryService } from './requery.service';

@Controller('requery')
@UseGuards(AuthGuard('jwt'))
export class RequeryController {
  constructor(private readonly requeryService: RequeryService) {}

  // User manually re-queries a pending transaction
  @Post(':orderId')
  async manualReQuery(
    @Req() req: any,
    @Param('orderId') orderId: string,
  ) {
    return this.requeryService.manualReQuery(orderId, req.user.id);
  }

  // Get all pending transactions for user
  @Get('pending')
  async getPending(@Req() req: any) {
    const data = await this.requeryService.getPendingTransactions(req.user.id);
    return {
      success: true,
      total:   data.length,
      data,
    };
  }

  // Admin — trigger cron manually
  @Post('admin/trigger')
  async triggerManual(@Req() req: any) {
    if (req.user.role !== 'ADMIN') {
      return { success: false, message: 'Admins only' };
    }
    await this.requeryService.runRequeryCron();
    return { success: true, message: 'Re-query cron triggered' };
  }
}