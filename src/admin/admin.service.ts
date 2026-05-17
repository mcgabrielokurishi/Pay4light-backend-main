// // src/admin/admin.service.ts
// import {
//   Injectable,
//   Logger,
//   NotFoundException,
//   BadRequestException,
// } from '@nestjs/common';
// import { PrismaService } from 'database/prisma.service';
// import { WalletService } from 'src/wallet/wallet.service';
// import { PushNotificationService } from 'src/push-notification/push-notification.service';
// import { NotificationService } from 'src/notification/notification.service';
// import { Prisma } from '@prisma/client';
// import {
//   GetUsersDto,
//   UserFilterStatus,
//   AdjustWalletDto,
//   BroadcastDto,
//   LockWalletDto,
// } from './dto/admin.dto';

// @Injectable()
// export class AdminService {
//   private readonly logger = new Logger(AdminService.name);

//   constructor(
//     private readonly prisma:        PrismaService,
//     private readonly walletService: WalletService,
//     private readonly push:          PushNotificationService,
//     private readonly notification:  NotificationService,
//   ) {}

//   // ─── DASHBOARD STATS ─────────────────────────────────────────────
//   async getDashboardStats() {
//     const now       = new Date();
//     const today     = new Date(now.setHours(0, 0, 0, 0));
//     const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

//     const [
//       totalUsers,
//       activeUsers,
//       verifiedUsers,
//       deletedUsers,
//       totalTransactions,
//       todayTransactions,
//       monthTransactions,
//       totalVendorTx,
//       successfulVends,
//       pendingVends,
//       failedVends,
//       totalWalletBalance,
//       totalRevenue,
//       todayRevenue,
//     ] = await Promise.all([
//       this.prisma.user.count(),
//       this.prisma.user.count({ where: { isActive: true } }),
//       this.prisma.user.count({ where: { isVerified: true } }),
//       this.prisma.user.count({ where: { deletedAt: { not: null } } }),
//       this.prisma.transaction.count(),
//       this.prisma.transaction.count({ where: { createdAt: { gte: today } } }),
//       this.prisma.transaction.count({ where: { createdAt: { gte: thisMonth } } }),
//       this.prisma.vendorTransaction.count(),
//       this.prisma.vendorTransaction.count({ where: { status: 'SUCCESS' } }),
//       this.prisma.vendorTransaction.count({ where: { status: 'PENDING' } }),
//       this.prisma.vendorTransaction.count({ where: { status: 'FAILED' } }),
//       this.prisma.wallet.aggregate({ _sum: { balance: true } }),
//       this.prisma.vendorTransaction.aggregate({
//         _sum:   { amount: true },
//         where:  { status: 'SUCCESS' },
//       }),
//       this.prisma.vendorTransaction.aggregate({
//         _sum:   { amount: true },
//         where:  { status: 'SUCCESS', createdAt: { gte: today } },
//       }),
//     ]);

//     return {
//       users: {
//         total:     totalUsers,
//         active:    activeUsers,
//         verified:  verifiedUsers,
//         deleted:   deletedUsers,
//         inactive:  totalUsers - activeUsers,
//       },
//       transactions: {
//         total:   totalTransactions,
//         today:   todayTransactions,
//         month:   monthTransactions,
//       },
//       vending: {
//         total:      totalVendorTx,
//         successful: successfulVends,
//         pending:    pendingVends,
//         failed:     failedVends,
//         successRate: totalVendorTx > 0
//           ? ((successfulVends / totalVendorTx) * 100).toFixed(1) + '%'
//           : '0%',
//       },
//       finance: {
//         totalWalletBalance: Number(totalWalletBalance._sum.balance ?? 0),
//         totalRevenue:       Number(totalRevenue._sum.amount ?? 0),
//         todayRevenue:       Number(todayRevenue._sum.amount ?? 0),
//       },
//     };
//   }

//   // ─── GET ALL USERS ────────────────────────────────────────────────
//   async getAllUsers(dto: GetUsersDto) {
//     const { search, status, page = 1, limit = 20 } = dto;

//     const where: Prisma.UserWhereInput = {
//       // Search by name, email, or phone
//       ...(search ? {
//         OR: [
//           { fullName:  { contains: search } },
//           { firstName: { contains: search } },
//           { lastName:  { contains: search } },
//           { email:     { contains: search } },
//           { phone:     { contains: search } },
//         ],
//       } : {}),

//       // Filter by status
//       ...(status === UserFilterStatus.ACTIVE     ? { isActive: true, deletedAt: null }  : {}),
//       ...(status === UserFilterStatus.INACTIVE   ? { isActive: false }                  : {}),
//       ...(status === UserFilterStatus.VERIFIED   ? { isVerified: true }                 : {}),
//       ...(status === UserFilterStatus.UNVERIFIED ? { isVerified: false }                : {}),
//       ...(status === UserFilterStatus.DELETED    ? { deletedAt: { not: null } }         : {}),
//     };

//     const [users, total] = await Promise.all([
//       this.prisma.user.findMany({
//         where,
//         select: {
//           id:            true,
//           fullName:      true,
//           firstName:     true,
//           lastName:      true,
//           email:         true,
//           phone:         true,
//           role:          true,
//           isActive:      true,
//           isVerified:    true,
//           failedAttempts: true,
//           lockedUntill:  true,
//           deletedAt:     true,
//           createdAt:     true,
//           discoId:       true,
//           wallet: {
//             select: {
//               balance:             true,
//               locked:              true,
//               virtualAccountNuban: true,
//             },
//           },
//           _count: {
//             select: {
//               Meter:        true,
//               transactions: true,
//             },
//           },
//         },
//         orderBy: { createdAt: 'desc' },
//         skip:    (page - 1) * limit,
//         take:    limit,
//       }),
//       this.prisma.user.count({ where }),
//     ]);

//     return {
//       data: users,
//       meta: {
//         total,
//         page,
//         limit,
//         totalPages:  Math.ceil(total / limit),
//         hasNextPage: page < Math.ceil(total / limit),
//       },
//     };
//   }

//   // ─── GET ONE USER ─────────────────────────────────────────────────
//   async getUser(userId: string) {
//     const user = await this.prisma.user.findUnique({
//       where:  { id: userId },
//       include: {
//         wallet: true,
//         Meter:  { include: { disco: true } },
//         transactions: {
//           orderBy: { createdAt: 'desc' },
//           take:    10,
//         },
//         _count: {
//           select: {
//             transactions:      true,
//             Meter:             true,
//             notifications:     true,
//             pushNotifications: true,
//           },
//         },
//       },
//     });

//     if (!user) throw new NotFoundException('User not found');
//     return user;
//   }

//   // ─── LOCK / UNLOCK USER ACCOUNT ───────────────────────────────────
//   async toggleUserLock(adminId: string, userId: string, lock: boolean) {
//     const user = await this.prisma.user.findUnique({ where: { id: userId } });
//     if (!user) throw new NotFoundException('User not found');
//     if (userId === adminId) throw new BadRequestException('Cannot lock your own account');

//     const lockUntil = lock
//       ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
//       : null;

//     await this.prisma.user.update({
//       where: { id: userId },
//       data:  { lockedUntil: lockUntil },
//     });

//     // Revoke all sessions if locking
//     if (lock) {
//       await this.prisma.refreshToken.updateMany({
//         where: { userId, revoked: false },
//         data:  { revoked: true },
//       });
//     }

//     // Notify user
//     await this.notification.create({
//       userId,
//       title:   lock ? '🔒 Account Locked' : '🔓 Account Unlocked',
//       message: lock
//         ? 'Your account has been locked by admin. Contact support.'
//         : 'Your account has been unlocked. You can log in again.',
//       type: 'SYSTEM',
//     });

//     this.logger.log(
//       `Account ${lock ? 'locked' : 'unlocked'} — userId: ${userId} by admin: ${adminId}`,
//     );

//     return {
//       success: true,
//       message: `User account ${lock ? 'locked' : 'unlocked'} successfully`,
//     };
//   }

//   // ─── TOGGLE USER ACTIVE STATUS ────────────────────────────────────
//   async toggleUserActive(adminId: string, userId: string, isActive: boolean) {
//     if (userId === adminId) {
//       throw new BadRequestException('Cannot deactivate your own account');
//     }

//     await this.prisma.user.update({
//       where: { id: userId },
//       data:  { isActive },
//     });

//     if (!isActive) {
//       await this.prisma.refreshToken.updateMany({
//         where: { userId, revoked: false },
//         data:  { revoked: true },
//       });
//     }

//     return {
//       success: true,
//       message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
//     };
//   }

//   // ─── UPDATE USER ROLE ─────────────────────────────────────────────
//   async updateUserRole(adminId: string, userId: string, role: 'USER' | 'ADMIN') {
//     if (userId === adminId) {
//       throw new BadRequestException('Cannot change your own role');
//     }

//     await this.prisma.user.update({
//       where: { id: userId },
//       data:  { role },
//     });

//     this.logger.log(`Role updated — userId: ${userId}, role: ${role} by admin: ${adminId}`);

//     return { success: true, message: `User role updated to ${role}` };
//   }

//   // ─── LOCK / UNLOCK WALLET ─────────────────────────────────────────
//   async toggleWalletLock(adminId: string, userId: string, dto: LockWalletDto) {
//     const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
//     if (!wallet) throw new NotFoundException('Wallet not found');

//     await this.prisma.wallet.update({
//       where: { userId },
//       data:  { locked: dto.locked },
//     });

//     await this.notification.create({
//       userId,
//       title:   dto.locked ? ' Wallet Locked' : ' Wallet Unlocked',
//       message: dto.locked
//         ? `Your wallet has been locked. Reason: ${dto.reason || 'Admin action'}. Contact support.`
//         : 'Your wallet has been unlocked. You can transact again.',
//       type: 'SYSTEM',
//     });

//     this.logger.log(
//       `Wallet ${dto.locked ? 'locked' : 'unlocked'} — userId: ${userId} by admin: ${adminId}`,
//     );

//     return {
//       success: true,
//       message: `Wallet ${dto.locked ? 'locked' : 'unlocked'} successfully`,
//     };
//   }

//   // ─── ADJUST WALLET BALANCE ────────────────────────────────────────
//   async adjustWalletBalance(adminId: string, userId: string, dto: AdjustWalletDto) {
//     const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
//     if (!wallet) throw new NotFoundException('Wallet not found');

//     const amount = new Prisma.Decimal(dto.amount.toString());

//     if (dto.type === 'CREDIT') {
//       await this.walletService.credit(
//         userId,
//         amount,
//         dto.reason || `Admin credit by ${adminId}`,
//       );

//       await this.notification.create({
//         userId,
//         title:   '💰 Wallet Credited by Admin',
//         message: `₦${dto.amount.toLocaleString()} has been added to your wallet. ${dto.reason || ''}`,
//         type:    'TRANSACTION',
//       });
//     } else {
//       const balance = Number(wallet.balance);
//       if (balance < dto.amount) {
//         throw new BadRequestException(
//           `Insufficient wallet balance. Current balance: ₦${balance.toLocaleString()}`,
//         );
//       }

//       await this.walletService.debit(
//         userId,
//         amount,
//         dto.reason || `Admin debit by ${adminId}`,
//       );

//       await this.notification.create({
//         userId,
//         title:   '💸 Wallet Debited by Admin',
//         message: `₦${dto.amount.toLocaleString()} has been deducted from your wallet. ${dto.reason || ''}`,
//         type:    'TRANSACTION',
//       });
//     }

//     this.logger.log(
//       `Wallet adjusted — userId: ${userId}, type: ${dto.type}, amount: ${dto.amount} by admin: ${adminId}`,
//     );

//     return {
//       success: true,
//       message: `Wallet ${dto.type.toLowerCase()}ed ₦${dto.amount.toLocaleString()} successfully`,
//     };
//   }

//   // ─── GET ALL TRANSACTIONS ─────────────────────────────────────────
//   async getAllTransactions(page = 1, limit = 20, userId?: string) {
//     const where = userId ? { userId } : {};

//     const [transactions, total] = await Promise.all([
//       this.prisma.transaction.findMany({
//         where,
//         include: {
//           user: {
//             select: { id: true, fullName: true, email: true },
//           },
//         },
//         orderBy: { createdAt: 'desc' },
//         skip:    (page - 1) * limit,
//         take:    limit,
//       }),
//       this.prisma.transaction.count({ where }),
//     ]);

//     return {
//       data: transactions,
//       meta: {
//         total,
//         page,
//         limit,
//         totalPages:  Math.ceil(total / limit),
//         hasNextPage: page < Math.ceil(total / limit),
//       },
//     };
//   }

//   // ─── GET ALL VENDOR TRANSACTIONS ─────────────────────────────────
//   async getAllVendorTransactions(
//     page   = 1,
//     limit  = 20,
//     status?: string,
//     userId?: string,
//   ) {
//     const where: any = {
//       ...(status ? { status } : {}),
//       ...(userId ? { userId } : {}),
//     };

//     const [transactions, total] = await Promise.all([
//       this.prisma.vendorTransaction.findMany({
//         where,
//         include: {
//           user: {
//             select: { id: true, fullName: true, email: true },
//           },
//         },
//         orderBy: { createdAt: 'desc' },
//         skip:    (page - 1) * limit,
//         take:    limit,
//       }),
//       this.prisma.vendorTransaction.count({ where }),
//     ]);

//     return {
//       data: transactions,
//       meta: {
//         total,
//         page,
//         limit,
//         totalPages:  Math.ceil(total / limit),
//         hasNextPage: page < Math.ceil(total / limit),
//       },
//     };
//   }

//   // ─── BROADCAST NOTIFICATION TO ALL USERS ─────────────────────────
//   async broadcastNotification(adminId: string, dto: BroadcastDto) {
//     // Get all active users
//     const users = await this.prisma.user.findMany({
//       where:  { isActive: true, deletedAt: null },
//       select: { id: true },
//     });

//     // Create in-app notification for all users
//     await this.prisma.notification.createMany({
//       data: users.map((u) => ({
//         userId:  u.id,
//         title:   dto.title,
//         message: dto.message,
//         type:    'SYSTEM' as any,
//       })),
//     });

//     // Push notification to all via topic
//     await this.push.broadcastToAll(dto.title, dto.message);

//     this.logger.log(
//       `Broadcast sent to ${users.length} users by admin: ${adminId}`,
//     );

//     return {
//       success:    true,
//       message:    `Broadcast sent to ${users.length} users`,
//       totalSent:  users.length,
//     };
//   }

//   // ─── GET SYSTEM OVERVIEW ──────────────────────────────────────────
//   async getSystemOverview() {
//     const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

//     const [
//       newUsersThisWeek,
//       revenueThisWeek,
//       pendingVends,
//       failedVendsThisWeek,
//       topDisco,
//     ] = await Promise.all([
//       this.prisma.user.count({
//         where: { createdAt: { gte: last7Days } },
//       }),
//       this.prisma.vendorTransaction.aggregate({
//         _sum:  { amount: true },
//         where: { status: 'SUCCESS', createdAt: { gte: last7Days } },
//       }),
//       this.prisma.vendorTransaction.count({
//         where: { status: 'PENDING' },
//       }),
//       this.prisma.vendorTransaction.count({
//         where: { status: 'FAILED', createdAt: { gte: last7Days } },
//       }),
//       this.prisma.vendorTransaction.groupBy({
//         by:      ['provider'],
//         _count:  { id: true },
//         where:   { status: 'SUCCESS' },
//         orderBy: { _count: { id: 'desc' } },
//         take:    1,
//       }),
//     ]);

//     return {
//       last7Days: {
//         newUsers:    newUsersThisWeek,
//         revenue:     Number(revenueThisWeek._sum.amount ?? 0),
//         failedVends: failedVendsThisWeek,
//       },
//       currentAlerts: {
//         pendingVends,
//       },
//       topProvider: topDisco[0]?.provider ?? 'N/A',
//     };
//   }

//   // ─── DELETE USER (Admin force delete) ────────────────────────────
//   async forceDeleteUser(adminId: string, userId: string) {
//     if (userId === adminId) {
//       throw new BadRequestException('Cannot delete your own account');
//     }

//     const user = await this.prisma.user.findUnique({ where: { id: userId } });
//     if (!user) throw new NotFoundException('User not found');

//     // Delete in correct order
//     await this.prisma.$transaction(async (tx) => {
//       await tx.refreshToken.deleteMany({ where: { userId } });
//       await tx.deviceToken.deleteMany({ where: { userId } });
//       await tx.pushNotification.deleteMany({ where: { userId } });
//       await tx.notification.deleteMany({ where: { userId } });
//       await tx.oTP.deleteMany({ where: { userId } });
//       await tx.savedCard.deleteMany({ where: { userId } });
//       await tx.meterUsageStats.deleteMany({ where: { userId } });
//       await tx.meter.deleteMany({ where: { userId } });
//       await tx.vendorTransaction.deleteMany({ where: { userId } });
//       await tx.transaction.deleteMany({ where: { userId } });
//       await tx.wallet.deleteMany({ where: { userId } });
//       await tx.user.delete({ where: { id: userId } });
//     });

//     this.logger.warn(
//       `User force deleted — userId: ${userId} by admin: ${adminId}`,
//     );

//     return { success: true, message: 'User permanently deleted' };
//   }
// }