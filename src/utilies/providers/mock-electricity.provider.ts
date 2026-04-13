import { Injectable } from "@nestjs/common";

@Injectable()
export class MockElectricityProvider {
  async validateMeter(disco: string, meterNumber: string) {
    return {
      valid: true,
      customerName: "me",
      address: "Lagos Nigeria",
    };
  }

  async purchase(disco: string, meterNumber: string, amount: number) {
    return {
      success: true,
      token: Math.random().toString().slice(2, 22),
      units: amount / 50,
    };
  }
}
