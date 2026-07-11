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
    private readonly httpService: HttpService,
    private readonly config:      ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('BUYPOWER_MFB_BASE_URL') || 'https://api.buypowermfb.net';
    this.apiKey  = this.config.get<string>('BUYPOWER_MFB_API_KEY')  || '';
  }

  private get headers() {
    return {
      Authorization:  `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private getExpiry(minutes: number): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString();
  }

  //  CREATE RESERVED ACCOUNT (permanent per user) 
 async createReservedAccount(data: {
    reference:   string;
    name:        string;
    description: string;
    nin?:        string;
    bvn?:        string;
  }) {
    try {
      this.logger.log(`Creating reserved account — ref: ${data.reference}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v1/accounts/reserved`,
          {
            reference:   data.reference,
            name:        data.name,
            description: data.description,
            nin:         data.nin || '95791401413', // hardcoded default NIN
            ...(data.bvn ? { bvn: data.bvn } : {}),
          },
          { headers: this.headers, timeout: 30000 },
        ),
      );

      this.logger.log(`Reserved account created: ${JSON.stringify(response.data)}`);
      return response.data;

    } catch (error) {
      const axiosError = error as any;
      this.logger.error('Create reserved account failed:', axiosError?.response?.data);
      throw new BadRequestException(
        axiosError?.response?.data?.message || 'Failed to create reserved account',
      );
    }
  }

  //  CREATE INVOICE ACCOUNT (one-time per vend) ─
  async createInvoiceAccount(data: {
    reference:   string;
    amount:      number;
    email:       string;
    name:        string;
    description: string;
    expiresAt?:  string;
  }) {
    try {
      this.logger.log(`Creating invoice account — ref: ${data.reference}, amount: ₦${data.amount}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v1/accounts/invoices`,
          {
            reference:   data.reference,
            name:        data.name,
            email:       data.email,
            description: data.description,
            amount:      data.amount,
            expiresAt:   data.expiresAt || this.getExpiry(30),
          },
          { headers: this.headers, timeout: 30000 },
        ),
      );

      this.logger.log(`Invoice account created: ${JSON.stringify(response.data)}`);
      return response.data;

    } catch (error) {
      const axiosError = error as any;
      this.logger.error('Create invoice account failed:', axiosError?.response?.data);
      throw new BadRequestException(
        axiosError?.response?.data?.message || 'Failed to create invoice account',
      );
    }
  }

  //  GET RESERVED ACCOUNT 
  async getReservedAccount(reference: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v1/accounts/reserved/${reference}`,
          { headers: this.headers },
        ),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw new BadRequestException(
        axiosError?.response?.data?.message || 'Failed to get reserved account',
      );
    }
  }

  //  GET ALL RESERVED ACCOUNTS
  async getAllReservedAccounts() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/v1/accounts/reserved`,
          { headers: this.headers },
        ),
      );
      return response.data;
    } catch (error) {
      throw new BadRequestException('Failed to fetch reserved accounts');
    }
  }
}