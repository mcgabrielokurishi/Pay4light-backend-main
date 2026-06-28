// src/buypower-mfb/buypower-mfb.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BuypowerMfbService {
  private readonly logger   = new Logger(BuypowerMfbService.name);
  private readonly baseUrl: string;
  private readonly apiKey:  string;

  constructor(
    private readonly httpService:  HttpService,
    private readonly config:       ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('BUYPOWER_BASE_URL') || 'https://api.buypowermfb.net';
    this.apiKey  = this.config.get<string>('BUYPOWER_API_KEY')  || '';
  }

  private get headers() {
    return {
      Authorization:  `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // ─── CREATE INVOICE ACCOUNT ──────────────────────────────────────
  // Creates a one-time account number the user pays into
  async createInvoiceAccount(data: {
    reference:   string;
    amount:      number;
    email:       string;
    name:        string;
    description: string;
    expiresAt?:  string; // ISO date string
  }) {
    try {
      console.log('Creating BuyPower invoice account:', data);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v1/accounts/invoices`,
          {
            reference:   data.reference,
            name:        data.name,
            email:       data.email,
            description: data.description,
            amount:      data.amount,
            expiresAt:   data.expiresAt || this.getExpiry(30), // 30 mins default
          },
          { headers: this.headers, timeout: 30000 },
        ),
      );

      console.log('BuyPower invoice response:', JSON.stringify(response.data));
      return response.data;

    } catch (error) {
      const axiosError = error as any;
      this.logger.error(
        'Create invoice account failed:',
        axiosError?.response?.data,
      );
      throw new BadRequestException(
        axiosError?.response?.data?.message || 'Failed to create invoice account',
      );
    }
  }

  // Returns expiry time as ISO string
  private getExpiry(minutes: number): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString();
  }
}