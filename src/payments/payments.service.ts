import { Injectable } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "database/prisma.service";
import { randomUUID } from "crypto";

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async initializePayment(userId: string, dto: any) {
    const reference = randomUUID();

    //  Save transaction (PENDING)
    await this.prisma.transaction.create({
      data: {
        userId,
        amount: dto.amount,
        meterId: "",
        walletId: "",
        status: "PENDING",
        reference,
        type: dto.type ?? "PAYMENT", // required by Prisma TransactionUncheckedCreateInput
        metadata: JSON.stringify({ email: dto.email }),
      },
    });

    //  Call Paystack
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: dto.email,
        amount: dto.amount * 100, // kobo
        reference,
        callback_url: "https://your-frontend.com/success",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    return {
      paymentUrl: (response.data as any).data.authorization_url,
      reference,
    };
  }
}