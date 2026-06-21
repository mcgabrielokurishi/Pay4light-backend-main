// src/monnify/monnify.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MonnifyService {
  private readonly logger    = new Logger(MonnifyService.name);
  private readonly baseUrl:  string;
  private readonly apiKey:   string;
  private readonly secretKey: string;
  private readonly contractCode: string;
  private accessToken: string | null = null;
  private tokenExpiry: number        = 0;

  constructor(
    private readonly httpService:    HttpService,
    private readonly configService:  ConfigService,
  ) {
    this.baseUrl      = this.configService.get<string>('MONNIFY_BASE_URL')      || 'https://sandbox.monnify.com';
    this.apiKey       = this.configService.get<string>('MONNIFY_API_KEY')       || '';
    this.secretKey    = this.configService.get<string>('MONNIFY_SECRET_KEY')    || '';
    this.contractCode = this.configService.get<string>('MONNIFY_CONTRACT_CODE') || '';
  }

  // ─── AUTH — Get Bearer Token ─────────────────────────────────────
  // Monnify uses Basic Auth to get a JWT token, then JWT for all requests
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const credentials = Buffer.from(
      `${this.apiKey}:${this.secretKey}`,
    ).toString('base64');

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/auth/login`,
          {},
          {
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const token = response.data?.responseBody?.accessToken;
      const expiresIn = response.data?.responseBody?.expiresIn || 3600;

      this.accessToken = token;
      this.tokenExpiry = Date.now() + (expiresIn - 60) * 1000; // refresh 60s early

      this.logger.log('Monnify access token refreshed');
      return token;

    } catch (error) {
      const axiosError = error as any;
      this.logger.error('Failed to get Monnify token:', axiosError?.response?.data);
      throw new InternalServerErrorException('Failed to authenticate with Monnify');
    }
  }

  private async authHeaders() {
    const token = await this.getAccessToken();
    return {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // ─── CREATE RESERVED ACCOUNT ─────────────────────────────────────
  // POST /api/v2/bank-transfer/reserved-accounts
 async createReservedAccount(data: {
  accountReference: string;
  accountName:      string;
  customerEmail:    string;
  customerName:     string;
  bvn?:             string;
  nin?:             string; // ✅ add this
}) {
  try {
    const headers = await this.authHeaders();

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/api/v2/bank-transfer/reserved-accounts`,
        {
          accountReference:    data.accountReference,
          accountName:         data.accountName,
          currencyCode:        'NGN',
          contractCode:        this.contractCode,
          customerEmail:       data.customerEmail,
          customerName:        data.customerName,
          getAllAvailableBanks: true,
          ...(data.bvn ? { bvn: data.bvn } : {}),
          ...(data.nin ? { nin: data.nin } : {}), // ✅ add NIN to payload
        },
        { headers, timeout: 30000 },
      ),
    );

    const body = response.data?.responseBody;
    this.logger.log(`Reserved account created: ${JSON.stringify(body)}`);
    return body;

  } catch (error) {
    const axiosError = error as any;
    this.logger.error(
      'Create reserved account failed:',
      axiosError?.response?.data,
    );
    throw new BadRequestException(
      axiosError?.response?.data?.responseMessage ||
      'Failed to create reserved account',
    );
  }
}
  // ─── GET RESERVED ACCOUNT DETAILS ────────────────────────────────
  // GET /api/v2/bank-transfer/reserved-accounts/{accountReference}
  async getReservedAccount(accountReference: string) {
    try {
      const headers = await this.authHeaders();
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/api/v2/bank-transfer/reserved-accounts/${accountReference}`,
          { headers },
        ),
      );
      return response.data?.responseBody;
    } catch (error) {
      const axiosError = error as any;
      throw new BadRequestException(
        axiosError?.response?.data?.responseMessage || 'Failed to get reserved account',
      );
    }
  }

  // ─── GET TRANSACTION STATUS ───────────────────────────────────────
  // GET /api/v2/merchant/transactions/query
  async getTransactionStatus(paymentReference: string) {
    try {
      const headers = await this.authHeaders();
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/api/v2/merchant/transactions/query`,
          {
            headers,
            params: { paymentReference },
          },
        ),
      );
      return response.data?.responseBody;
    } catch (error) {
      const axiosError = error as any;
      throw new BadRequestException(
        axiosError?.response?.data?.responseMessage || 'Failed to get transaction status',
      );
    }
  }

  // ─── INITIALIZE TRANSACTION (for card/bank transfer checkout) ────
  // POST /api/v1/merchant/transactions/init-transaction
  async initializeTransaction(data: {
    amount:           number;
    customerName:     string;
    customerEmail:    string;
    paymentReference: string;
    paymentDescription: string;
    redirectUrl?:     string;
  }) {
    try {
      const headers = await this.authHeaders();
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/merchant/transactions/init-transaction`,
          {
            amount:             data.amount,
            customerName:       data.customerName,
            customerEmail:      data.customerEmail,
            paymentReference:   data.paymentReference,
            paymentDescription: data.paymentDescription,
            currencyCode:       'NGN',
            contractCode:       this.contractCode,
            redirectUrl:        data.redirectUrl || process.env.MONNIFY_CALLBACK_URL,
            paymentMethods:     ['CARD', 'ACCOUNT_TRANSFER'],
          },
          { headers },
        ),
      );

      return response.data?.responseBody;
    } catch (error) {
      const axiosError = error as any;
      throw new BadRequestException(
        axiosError?.response?.data?.responseMessage || 'Failed to initialize transaction',
      );
    }
  }

  // ─── CHARGE CARD TOKEN (saved card) ──────────────────────────────
  // POST /api/v1/merchant/cards/charge-card-token
  async chargeCardToken(data: {
    cardToken:        string;
    customerEmail:    string;
    amount:           number;
    paymentReference: string;
    paymentDescription: string;
  }) {
    try {
      const headers = await this.authHeaders();
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/merchant/cards/charge-card-token`,
          {
            cardToken:          data.cardToken,
            customerEmail:      data.customerEmail,
            amount:             data.amount,
            paymentReference:   data.paymentReference,
            paymentDescription: data.paymentDescription,
            currencyCode:       'NGN',
            contractCode:       this.contractCode,
          },
          { headers },
        ),
      );

      return response.data?.responseBody;
    } catch (error) {
      const axiosError = error as any;
      throw new BadRequestException(
        axiosError?.response?.data?.responseMessage || 'Card charge failed',
      );
    }
  }
}