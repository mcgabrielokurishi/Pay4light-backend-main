import {
  Controller,
  Get,
  Query,
  Res,
  Param,
  UseGuards,
} from "@nestjs/common";
import { TransactionsService } from "./transactions.service";
import { JwtAuthGuard } from "../common/guards/jwt.guard";
import { CurrentUser } from "../common/decorators/user.decorator";
import { QueryTransactionsDto } from "./dto/query-transactions.dto";
import { Response } from 'express';

@Controller("transactions")
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  getMyTransactions(
    @CurrentUser() user,
    @Query() query: QueryTransactionsDto
  ) {
    return this.transactionsService.getUserTransactions(user.id, query);
  }

  @Get(":id")
  getSingleTransaction(
    @CurrentUser() user,
    @Param("id") id: string
  ) {
    return this.transactionsService.getSingleTransaction(user.id, id);
  }
  @Get('transactions/export/csv')
  async exportCSV(
  @CurrentUser('id') userId: string,
  @Res() res: Response,
) {
  const csv = await this.transactionsService.exportUserTransactionsCSV(userId);

  res.header('Content-Type', 'text/csv');
  res.attachment('transactions.csv');
  return res.send(csv);
}
}
