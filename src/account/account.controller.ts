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

  /**
   * POST /account/deactivate
   *
   * Temporarily deactivates the user's account.
   * - User cannot log in after this
   * - All data is preserved
   * - Account can be reactivated by contacting support
   *
   * Body: { password: string, reason?: string }
   */
  @Post("deactivate")
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Req() req: any,
    @Body() dto: DeactivateAccountDto,
  ) {
    return this.accountService.deactivateAccount(req.user.id, dto);
  }

  /**
   * DELETE /account
   *
   * Permanently deletes the user's account (soft delete).
   * - User cannot log in after this
   * - PII is anonymised immediately
   * - Wallet must be empty before deletion is allowed
   * - Cannot be undone
   *
   * Body: { password: string, reason?: string }
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async delete(
    @Req() req: any,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.accountService.deleteAccount(req.user.id, dto);
  }
}
