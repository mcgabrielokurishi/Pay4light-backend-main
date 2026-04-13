import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';//  import guard
import { CurrentUser } from 'src/common/decorators/user.decorator'; //  import decorator
import { TransactionsService } from 'src/transaction/transactions.service'; //  import service

@ApiTags('consumption')
@ApiBearerAuth()
@Controller('consumption') 
@UseGuards(JwtAuthGuard)   
export class ConsumptionController { 
  constructor(
    private readonly transactionService: TransactionsService, //inject service
  ) {}

  // GET /consumption?month=3&year=2026
  @Get()
  async getConsumption(
    @CurrentUser() user: any,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();

    return this.transactionService.getAllUserTransactions(user.id, m, y);
  }
}