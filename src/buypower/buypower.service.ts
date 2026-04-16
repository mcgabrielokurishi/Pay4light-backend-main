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
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v1/accounts/reserved`,
          {
            reference: dto.reference,
            name: dto.name,
            email: dto.email,
          },
          { headers: this.headers },
        ),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      this.logger.error('Failed to create reserved account', axiosError?.response?.data);
      throw new BadRequestException(
        (axiosError?.response?.data as any)?.message || 'Failed to create reserved account',
      );
    }
  }

  /**
   * Fetch all reserved accounts (for reconciliation/admin use)
   */
  async getReservedAccounts() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/v1/accounts/reserved`, {
          headers: this.headers,
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      this.logger.error('Failed to fetch reserved accounts', axiosError?.response?.data);
      throw new BadRequestException('Failed to fetch reserved accounts');
    }
  }

  async createInvoiceAccount(dto: CreateInvoiceAccountDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v1/accounts/invoices`,
          {
            reference: dto.reference,
            name: dto.name,
            email: dto.email,
            description: dto.description || 'Wallet funding',
            expiresAt: dto.expiresAt,
            amount: dto.amount,
          },
          { headers: this.headers },
        ),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      this.logger.error('Failed to create invoice account', axiosError?.response?.data);
      throw new BadRequestException(
        (axiosError?.response?.data as any)?.message || 'Failed to create invoice account',
      );
    }
  }

  /**
   * Get all invoice accounts (paginated)
   */
  async getInvoiceAccounts(page = 1, pageSize = 10) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/v1/accounts/invoices`, {
          headers: this.headers,
          params: { page, pageSize },
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      this.logger.error('Failed to fetch invoice accounts', axiosError?.response?.data);
      throw new BadRequestException('Failed to fetch invoice accounts');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TRANSACTIONS
  // ─────────────────────────────────────────────────────────────────

  async getTransactions(page = 1, pageSize = 20) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/v1/transactions`, {
          headers: this.headers,
          params: { page, pageSize },
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      this.logger.error('Failed to fetch transactions', axiosError?.response?.data);
      throw new BadRequestException('Failed to fetch transactions');
    }
  }
}
