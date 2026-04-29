import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CreateReservedAccountDto } from './dto/create-reserved-account.dto';
import { CreateInvoiceAccountDto } from './dto/create-invoice-account.dto';

@Injectable()
export class BuypowerService {
  private readonly logger = new Logger(BuypowerService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('BUYPOWER_BASE_URL') || '';
    this.apiKey = this.configService.get<string>('BUYPOWER_API_KEY') || '';
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  
async createReservedAccount(dto: CreateReservedAccountDto) {
  try {
    console.log('Sending to BuyPower:', {
      url: `${this.baseUrl}/v1/accounts/reserved`,
      payload: dto,
    });

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/v1/accounts/reserved`, //  correct path
        {
          reference:   dto.exRef,
          name:        dto.name,
          description: dto.description,
          nin:         '95791401413', //  hardcoded NIN for all accounts
        },
        {
          headers: this.headers,
          timeout: 30000,
        },
      ),
    );

    console.log('BuyPower success:', response.data);
    return response.data;

  } catch (error) {
    const axiosError = error as any;
    console.error('BuyPower error:', {
      status:  axiosError?.response?.status,
      data:    axiosError?.response?.data,
      message: axiosError?.message,
      code:    axiosError?.code,
    });

    if (!axiosError?.response) {
      throw new BadRequestException(
        `Cannot reach BuyPower API: ${axiosError?.message}`,
      );
    }

    throw new BadRequestException(
      axiosError?.response?.data?.message || 'Failed to create reserved account',
    );
  }
}
}