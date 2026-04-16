import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "database/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { VendElectricityDto } from "./dto/vend-electricity.dto";
import { Prisma } from "@prisma/client";
import axios from "axios";
import { randomUUID } from "crypto";

@Injectable()
export class VendorService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService
  ) {}

  async vendElectricity(userId: string, dto: VendElectricityDto) {
    const reference = randomUUID();
    const amount = new Prisma.Decimal(dto.amount);

    //  Create pending vendor transaction
     const vendorTx = await this.prisma.vendorTransaction.create({
    data: {
      userId,
      reference,
      provider: "STRONPOWER",
      serviceType: "ELECTRICITY",   
      meterID: dto.meterId,  
      amount: Number(amount),
      status: "PENDING",
      requestPayload: JSON.parse(JSON.stringify(dto)),
    },
  });

    // Debit wallet FIRST
    await this.walletService.debitWithIdempotency(
      userId,
      amount,
      reference,
      "Electricity vending"
    );

    try {
      // Call external API
      const response = await axios.post(
        `${process.env.VENDOR_BASE_URL}/api/VendingMeterDirectly`,
        {
          CompanyName: process.env.VENDOR_COMPANY,
          UserName: process.env.VENDOR_USERNAME,
          PassWord: process.env.VENDOR_PASSWORD,
          MeterID: dto.meterId,
          Amount: dto.amount.toString(),
        }
      );

      const data = response.data as any;

      // You must adjust based on actual response structure
      if (!data || data.Status !== "SUCCESS") {
        throw new Error("Vendor API failed");
      }

      // Mark SUCCESS
      await this.prisma.vendorTransaction.update({
        where: { reference },
        data: {
          status: "SUCCESS",
          responsePayload: data,
          token: data.Token,
          units: data.Units,
        },
      });

      return {
        reference,
        token: data.Token,
        units: data.Units,
      };
    } catch (error) {
      // REFUND if vendor fails
      await this.walletService.credit(
        userId,
        amount,
        "Refund - Electricity vending failed"
      );

      const errorData = error instanceof Error ? error.message : (error as any).response?.data || "Unknown error";

      await this.prisma.vendorTransaction.update({
        where: { reference },
        data: {
          status: "FAILED",
          responsePayload: errorData,
        },
      });

      throw new BadRequestException("Vending failed. Wallet refunded.");
    }
  }
}