// import { Injectable } from "@nestjs/common";
// import { Prisma } from "@prisma/client";
// import { PrismaService } from "database/prisma.service";

// @Injectable()
// export class LedgerService {
//   constructor(private prisma: PrismaService) {}

//   async createTransaction(data: {
//     reference: string;
//     description?: string;
//     entries: {
//       accountId: string;
//       type: "DEBIT" | "CREDIT";
//       amount: Prisma.Decimal;
//     }[];
//   }) {
//     return this.prisma.$transaction(async (tx) => {
//       //  Validate balance
//       for (const entry of data.entries) {
//         if (entry.type === "DEBIT") {
//           const account = await tx.ledgerAccount.findUnique({
//             where: { id: entry.accountId },
//           });

//           if (!account || account.balance.lt(entry.amount)) {
//             throw new Error("Insufficient funds");
//           }
//         }
//       }

//       //  Create transaction
//       const transaction = await tx.ledgerTransaction.create({
//         data: {
//           reference: data.reference,
//           description: data.description,
//           status: "SUCCESS",
//         },
//       });

//       // Create entries + update balances
//       for (const entry of data.entries) {
//         await tx.ledgerEntry.create({
//           data: {
//             transactionId: transaction.id,
//             accountId: entry.accountId,
//             type: entry.type,
//             amount: entry.amount,
            
//           },
//         });

//         await tx.ledgerAccount.update({
//           where: { id: entry.accountId },
//           data: {
//             balance:
//               entry.type === "DEBIT"
//                 ? { decrement: entry.amount }
//                 : { increment: entry.amount },
//           },
//         });
//       }

//       return transaction;
//     });
//   }
// }