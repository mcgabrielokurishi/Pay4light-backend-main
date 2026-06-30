import {
  Controller,
  Post,
  Delete,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AccountService } from "./account.service";
import { DeactivateAccountDto } from "./dto/deactivate-account.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("account")
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post("deactivate")
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Req() req: any,
    @Body() dto: DeactivateAccountDto,
  ) {
    return this.accountService.deactivateAccount(req.user.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async delete(
    @Req() req: any,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.accountService.deleteAccount(req.user.id, dto);
  }
}
