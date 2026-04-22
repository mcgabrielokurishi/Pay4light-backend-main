import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { DeactivateAccountDto } from "./dto/deactivate-account.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import * as bcrypt from "bcrypt";

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────
  // DEACTIVATE ACCOUNT
  //
  // Sets isActive = false. User can no longer log in.
  // All data is preserved — account can be reactivated by admin or
  // by the user contacting support.
  // ─────────────────────────────────────────────────────────────────

  async deactivateAccount(userId: string, dto: DeactivateAccountDto) {
    const user = await this.findUser(userId);

    // Verify password before allowing deactivation
    await this.verifyPassword(dto.password, user.password);

    if (!user.isActive) {
      throw new BadRequestException("Account is already deactivated");
    }

    // Deactivate: flip isActive flag + revoke all refresh tokens
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      }),
      // Revoke all active sessions
      this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      }),
    ]);

    this.logger.log(
      `Account deactivated — userId: ${userId}${dto.reason ? `, reason: ${dto.reason}` : ""}`,
    );

    return {
      message:
        "Your account has been deactivated. Contact support to reactivate.",
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // DELETE ACCOUNT (Soft delete)
  //
  // Sets deletedAt = now(). User cannot log in.
  // Data is kept in DB for compliance/audit but treated as deleted.
  // After a retention period (e.g. 30 days), a separate cleanup job
  // can hard-delete the record if needed.
  // ─────────────────────────────────────────────────────────────────

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.findUser(userId);

    // Verify password before allowing deletion
    await this.verifyPassword(dto.password, user.password);

    if (user.deletedAt) {
      throw new BadRequestException("Account is already scheduled for deletion");
    }

    // Check wallet balance — warn user if they have funds remaining
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (wallet && wallet.balance > 0) {
      throw new BadRequestException(
        `Please withdraw your wallet balance of ₦${wallet.balance.toLocaleString()} before deleting your account`,
      );
    }

    // Soft delete: set deletedAt + isActive=false + revoke all sessions
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          isActive: false,
          // Anonymise PII fields
          email: `deleted_${userId}@deleted.invalid`,
          phone: null,
          firstName: "Deleted",
          lastName: "User",
          fullName: "Deleted User",
        },
      }),
      // Revoke all sessions
      this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      }),
      // Lock wallet
      ...(wallet
        ? [this.prisma.wallet.update({
            where: { userId },
            data: { locked: true },
          })]
        : []),
    ]);

    this.logger.log(
      `Account deleted — userId: ${userId}${dto.reason ? `, reason: ${dto.reason}` : ""}`,
    );

    return {
      message:
        "Your account has been permanently deleted. We're sorry to see you go.",
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // REACTIVATE ACCOUNT (Admin or support use)
  // ─────────────────────────────────────────────────────────────────

  async reactivateAccount(userId: string) {
    const user = await this.findUser(userId);

    if (user.deletedAt) {
      throw new BadRequestException(
        "Deleted accounts cannot be reactivated. Please register a new account.",
      );
    }

    if (user.isActive) {
      throw new BadRequestException("Account is already active");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    this.logger.log(`Account reactivated — userId: ${userId}`);
    return { message: "Account reactivated successfully" };
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  private async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ) {
    const isValid = await bcrypt.compare(plainPassword, hashedPassword);
    if (!isValid) {
      throw new UnauthorizedException("Incorrect password");
    }
  }
}
