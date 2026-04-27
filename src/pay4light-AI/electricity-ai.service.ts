import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { PrismaService } from 'database/prisma.service';
import { VendingService } from 'src/vendor/vendor.service';
import { WalletService } from 'src/wallet/wallet.service';
import { AI_TOOLS } from './ai.tools';
import { ELECTRICAL_KNOWLEDGE } from './knowledge-base/Knowlege';
import { ChatDto } from './dto/ai.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private vendorService: VendingService,
    private walletService: WalletService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async chat(userId: string, dto: ChatDto) {
    const { message, conversationId } = dto;

    let conversation = conversationId
      ? await this.prisma.aIConversation.findFirst({
          where: { id: conversationId, userId },
        })
      : null;

    const history: ChatCompletionMessageParam[] = conversation
      ? (JSON.parse(conversation.message) as ChatCompletionMessageParam[])
      : [];

    // Add user message
    history.push({ role: 'user', content: message });

    // Call OpenAI
    const response = await this.callOpenAI(userId, history);

    // Save conversation
    if (conversation) {
      await this.prisma.aIConversation.update({
        where: { id: conversation.id },
        data: { message: JSON.stringify(history) },
      });
    } else {
      conversation = await this.prisma.aIConversation.create({
        data: { userId, message: JSON.stringify(history), role: 'user' },
      });
    }

    return {
      reply: response,
      conversationId: conversation.id,
    };
  }

  private async callOpenAI(
    userId: string,
    history: ChatCompletionMessageParam[],
  ): Promise<string> {
    let messages: any[] = [
      {
        role: 'system',
        content: ELECTRICAL_KNOWLEDGE,
      },
      ...history,
    ];

    while (true) {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: AI_TOOLS as ChatCompletionTool[],
        tool_choice: 'auto',
      });

      const choice = response.choices[0].message;

      // ✅ Normal response
      if (!choice.tool_calls) {
        const text = choice.content || '';

        history.push({
          role: 'assistant',
          content: text,
        });

        return text;
      }

      //  Tool calls
      messages.push(choice);

      for (const toolCall of choice.tool_calls) {
        if (toolCall.type !== 'function') continue;

        const toolName = toolCall.function.name || '';
        const args = JSON.parse(toolCall.function.arguments || '{}');

        this.logger.log(`AI calling tool: ${toolName}`);

        const result = await this.executeTool(userId, toolName, args);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }
  }

  private async executeTool(
    userId: string,
    toolName: string,
    input: Record<string, any>,
  ) {
    try {
      switch (toolName) {
        case 'get_wallet_balance':
          return await this.getWalletBalance(userId);

        case 'get_user_meters':
          return await this.getUserMeters(userId);

        case 'buy_electricity':
          return await this.buyElectricity(
            userId,
            input.meterId,
            input.amount,
          );

        case 'get_transaction_history':
          return await this.getTransactionHistory(
            userId,
            input.meterId,
            input.limit || 10,
          );

        case 'forecast_token_expiry':
          return await this.forecastTokenExpiry(userId, input.meterId);

        case 'get_disco_info':
          return await this.getDiscoInfo(input.discoCode);

        case 'add_meter':
          return await this.addMeter(userId, input);

        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      this.logger.error(`Tool ${toolName} failed:`, error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  // ================= TOOLS =================

  private async getWalletBalance(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    return {
      balance: wallet?.balance ?? 0,
      currency: 'NGN',
    };
  }

  private async getUserMeters(userId: string) {
    const meters = await this.prisma.meter.findMany({
      where: { userId },
      include: { disco: true },
    });

    return meters.map((m) => ({
      id: m.id,
      meterNumber: m.meterNumber,
      meterType: m.meterType,
      disco: m.disco.name,
      discoCode: m.disco.code,
      address: m.address,
      isDefault: m.isDefault,
    }));
  }

  private async buyElectricity(
    userId: string,
    meterId: string,
    amount: number,
  ) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });

    if (!wallet || wallet.balance < amount) {
      return { success: false, error: 'Insufficient wallet balance' };
    }

    const meter = await this.prisma.meter.findFirst({
      where: { id: meterId, userId },
      include: { disco: true },
    });

    if (!meter) {
      return { success: false, error: 'Meter not found' };
    }

    // TODO: integrate vendor service
    return {
      success: false,
      message: 'Electricity purchase not implemented yet',
    };
  }

  private async getTransactionHistory(
    userId: string,
    meterId?: string,
    limit = 10,
  ) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        ...(meterId ? { meterId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { meter: { include: { disco: true } } },
    });

    return transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      units: t.kwh,
      token: t.token,
      status: t.status,
      meter: t.meter?.meterNumber,
      disco: t.meter?.disco?.name,
      date: t.createdAt,
    }));
  }

  private async forecastTokenExpiry(userId: string, meterId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        meterId,
        type: 'ELECTRICITY_PURCHASE',
        status: 'SUCCESS',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (transactions.length < 2) {
      return {
        forecast: null,
        message: 'Not enough transaction history to forecast',
      };
    }

    const intervals: number[] = [];

    for (let i = 0; i < transactions.length - 1; i++) {
      const diff =
        transactions[i].createdAt.getTime() -
        transactions[i + 1].createdAt.getTime();

      intervals.push(diff / (1000 * 60 * 60 * 24));
    }

    const avgDays =
      intervals.reduce((a, b) => a + b, 0) / intervals.length;

    const lastPurchase = transactions[0].createdAt;

    const forecastedExpiry = new Date(
      lastPurchase.getTime() + avgDays * 24 * 60 * 60 * 1000,
    );

    const daysLeft = Math.max(
      0,
      Math.ceil(
        (forecastedExpiry.getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    return {
      lastPurchase,
      forecastedExpiry,
      daysLeft,
      avgDaysBetweenPurchases: Math.round(avgDays),
      message:
        daysLeft <= 3
          ? `Your electricity may run out in ${daysLeft} day(s). Top up soon!`
          : `You have approximately ${daysLeft} days of electricity left.`,
    };
  }

  private async getDiscoInfo(discoCode: string) {
    const disco = await this.prisma.disco.findUnique({
      where: { code: discoCode.toUpperCase() },
    });

    if (!disco) {
      return { error: `DISCO with code ${discoCode} not found` };
    }

    return {
      name: disco.name,
      code: disco.code,
      statesCovered: disco.states,
      tariffRate: `₦${disco.tariffRate} per kWh`,
      supportPhone: disco.supportPhone,
      supportEmail: disco.supportEmail,
      website: disco.website,
    };
  }

  private async addMeter(userId: string, input: any) {
    const disco = await this.prisma.disco.findUnique({
      where: { code: input.discoCode.toUpperCase() },
    });

    if (!disco) {
      return { success: false, error: `DISCO ${input.discoCode} not found` };
    }

    const existing = await this.prisma.meter.findUnique({
      where: { meterNumber: input.meterNumber },
    });

    if (existing) {
      return { success: false, error: 'Meter already registered' };
    }

    const meter = await this.prisma.meter.create({
      data: {
        userId,
        meterNumber: input.meterNumber,
        meterType: input.meterType,
        discoId: disco.id,
        address: input.address,
      },
    });

    return {
      success: true,
      message: 'Meter added successfully',
      meterId: meter.id,
      meterNumber: meter.meterNumber,
    };
  }
}