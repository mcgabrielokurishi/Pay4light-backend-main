import { Injectable, InternalServerErrorException } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class VendorAdapter {
  private readonly http: any;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.VENDOR_BASE_URL,
      timeout: 15000, // 15 seconds timeout
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

 
   //Calls Stronpower electricity vending API
  
  async vendElectricity(meterId: string, amount: number) {
    try {
      const response = await this.http.post(
        "/api/VendingMeterDirectly",
        {
          CompanyName: process.env.VENDOR_COMPANY,
          UserName: process.env.VENDOR_USERNAME,
          PassWord: process.env.VENDOR_PASSWORD,
          MeterID: meterId,
          Amount: amount.toString(),
        }
      );

      return response.data;
    } catch (error: any) {
      // Network error
      if (error.code === "ECONNABORTED") {
        throw new InternalServerErrorException(
          "Vendor request timeout"
        );
      }

      // Vendor returned error response
      if (error.response) {
        throw new InternalServerErrorException(
          error.response.data || "Vendor API error"
        );
      }

      // Unknown error
      throw new InternalServerErrorException(
        "Unable to reach vendor service"
      );
    }
  }
}