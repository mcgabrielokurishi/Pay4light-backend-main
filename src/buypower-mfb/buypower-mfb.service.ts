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

  //CREATE INVOICE ACCOUNT 

 async createInvoiceAccount(data: {
  reference:   string;
  amount:      number;
  email:       string;
  name:        string;
  description: string;
  expiresAt?:  string;
}) {
  try {
    //  
    console.log('BuyPower MFB URL:', `${this.baseUrl}/v1/accounts/invoices`);
    console.log('BuyPower MFB API Key:', this.apiKey ? `${this.apiKey.slice(0, 15)}...` : 'MISSING');
    console.log('Payload:', JSON.stringify(data, null, 2));

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
        {
          headers: this.headers,
          timeout: 30000,
        },
      ),
    );

    console.log('BuyPower MFB success:', JSON.stringify(response.data));
    return response.data;

  } catch (error) {
    const axiosError = error as any;

    //Log everything
    console.error('BuyPower MFB error status:', axiosError?.response?.status);
    console.error('BuyPower MFB error data:', JSON.stringify(axiosError?.response?.data));
    console.error('BuyPower MFB error message:', axiosError?.message);
    console.error('BuyPower MFB request URL:', axiosError?.config?.url);
    console.error('BuyPower MFB request body:', axiosError?.config?.data);

    this.logger.error(
      'Create invoice account failed:',
      axiosError?.response?.data,
    );

    throw new BadRequestException(
      axiosError?.response?.data?.message || 'Failed to create invoice account',
    );
  }
}

  // Returns expiry time
  private getExpiry(minutes: number): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString();
  }
}