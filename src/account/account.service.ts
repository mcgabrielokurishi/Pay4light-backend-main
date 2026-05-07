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

  // ─── DEACTIVATE ACCOUNT ──────────────────────────────────────────
  async deactivateAccount(userId: string, dto: DeactivateAccountDto) {
    const user = await this.findUser(userId);

    await this.verifyPassword(dto.password, user.password);

    if (!user.isActive) {
      throw new BadRequestException("Account is already deactivated");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data:  { isActive: false },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data:  { revoked: true },
      }),
    ]);

    this.logger.log(`Account deactivated — userId: ${userId}`);

    return {
      message: "Your account has been deactivated. Contact support to reactivate.",
    };
  }

  // ─── DELETE ACCOUNT ──────────────────────────────────────────────
  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.findUser(userId);

    await this.verifyPassword(dto.password, user.password);

    if (user.deletedAt) {
      throw new BadRequestException("Account is already scheduled for deletion");
    }

    // Check wallet balance — must withdraw first
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (wallet && Number(wallet.balance) > 0) {
      throw new BadRequestException(
        `Please withdraw your wallet balance of ₦${Number(wallet.balance).toLocaleString()} before deleting your account`,
      );
    }

    this.logger.log(`Starting full account deletion for userId: ${userId}`);

    // ✅ Delete everything in correct order (respect FK constraints)
    await this.prisma.$transaction(async (tx) => {

      // 1. Revoke all sessions first
      await tx.refreshToken.deleteMany({ where: { userId } });

      // 2. Delete device tokens (push notifications)
      await tx.deviceToken.deleteMany({ where: { userId } });

      // 3. Delete push notification history
      await tx.pushNotification.deleteMany({ where: { userId } });

      // 4. Delete in-app notifications
      await tx.notification.deleteMany({ where: { userId } });

      // 5. Delete OTPs
      await tx.oTP.deleteMany({ where: { userId } });

      // 6. Delete AI conversations
      await tx.aIConversation.deleteMany({ where: { userId } });

      // 7. Delete saved cards
      await tx.savedCard.deleteMany({ where: { userId } });

      // 8. Delete meter usage stats (before meters)
      await tx.meterUsageStats.deleteMany({ where: { userId } });

      // 9. Delete meters (removes DISCO relation automatically)
      await tx.meter.deleteMany({ where: { userId } });

      // 10. Delete vendor transactions
      await tx.vendorTransaction.deleteMany({ where: { userId } });

      // 11. Delete wallet transactions
      await tx.transaction.deleteMany({ where: { userId } });

      // 12. Delete wallet
      if (wallet) {
        await tx.wallet.delete({ where: { userId } });
      }

      // 13. Finally delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    this.logger.log(
      `Account fully deleted — userId: ${userId}${dto.reason ? `, reason: ${dto.reason}` : ""}`,
    );

    return {
      message: "Your account and all associated data have been permanently deleted.",
    };
  }

  // ─── REACTIVATE ACCOUNT ──────────────────────────────────────────
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
      data:  { isActive: true },
    });

    this.logger.log(`Account reactivated — userId: ${userId}`);
    return { message: "Account reactivated successfully" };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────
  private async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  private async verifyPassword(plain: string, hashed: string) {
    const isValid = await bcrypt.compare(plain, hashed);
    if (!isValid) throw new UnauthorizedException("Incorrect password");
  }
                                                  }
