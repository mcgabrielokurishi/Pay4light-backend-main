// src/ai/ai.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Content,
} from '@google/generative-ai';
import { PrismaService } from 'database/prisma.service';
import { SYSTEM_PROMPT } from './knowledge-base/Knowlege';
import { ChatDto } from './dto/ai.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI:  GoogleGenerativeAI;
  private readonly model:  any;

  constructor(private readonly prisma: PrismaService) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // ✅ Use gemini-1.5-flash — free tier, fast, capable
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature:     0.7,
        topP:            0.9,
      },
      safetySettings: [
        {
          category:  HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category:  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
  }

  // ─── MAIN CHAT METHOD ─────────────────────────────────────────────
  async chat(userId: string, dto: ChatDto) {
    const { message, conversationId } = dto;

    if (!message?.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }

    // Load or create conversation
    let conversation = conversationId
      ? await this.prisma.aIConversation.findFirst({
          where: { id: conversationId, userId },
        })
      : null;

    // Build history for Gemini
    const history: Content[] = conversation
      ? (conversation.messages as unknown as Content[])
      : [];

    try {
      // Start chat with history
      const chat = this.model.startChat({ history });

      // Send message
      const result   = await chat.sendMessage(message);
      const response = await result.response;
      const reply    = response.text();

      // Update history
      const updatedHistory: Content[] = [
        ...history,
        { role: 'user',  parts: [{ text: message }] },
        { role: 'model', parts: [{ text: reply }] },
      ];

      // Save conversation
      if (conversation) {
        await this.prisma.aIConversation.update({
          where: { id: conversation.id },
          data:  { messages: updatedHistory as any },
        });
      } else {
        conversation = await this.prisma.aIConversation.create({
          data: {
            userId,
            messages: updatedHistory as any,
          },
        });
      }

      this.logger.log(`AI chat — userId: ${userId}, tokens used: ${response.usageMetadata?.totalTokenCount ?? 'unknown'}`);

      return {
        success:        true,
        reply,
        conversationId: conversation.id,
        tokensUsed:     response.usageMetadata?.totalTokenCount,
      };

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Gemini AI error:', message);

      // Handle rate limit
      if (message.includes('429') || message.includes('quota')) {
        throw new BadRequestException(
          'AI assistant is temporarily busy. Please try again in a moment.',
        );
      }

      throw new BadRequestException(
        'AI assistant encountered an error. Please try again.',
      );
    }
  }

  // ─── GET CONVERSATION HISTORY ─────────────────────────────────────
  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      return { messages: [] };
    }

    const messages = (conversation.messages as unknown as Content[]).map((m) => ({
      role:    m.role === 'model' ? 'assistant' : 'user',
      message: m.parts?.[0]?.text ?? '',
    }));

    return {
      conversationId: conversation.id,
      messages,
      createdAt:      conversation.createdAt,
      updatedAt:      conversation.updatedAt,
    };
  }

  // ─── GET ALL CONVERSATIONS ────────────────────────────────────────
  async getAllConversations(userId: string) {
    const conversations = await this.prisma.aIConversation.findMany({
      where:   { userId },
      orderBy: { updatedAt: 'desc' },
      take:    20,
      select: {
        id:        true,
        createdAt: true,
        updatedAt: true,
        message:  true,
      },
    });

    return conversations.map((c) => {
      const msgs     = (c.message as unknown as Content[]) || [];
      const firstMsg = msgs.find((m) => m.role === 'user');
      const preview  = firstMsg?.parts?.[0]?.text?.slice(0, 60) ?? 'New conversation';

      return {
        id:        c.id,
        preview:   preview + (preview.length >= 60 ? '...' : ''),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: msgs.length,
      };
    });
  }

  // ─── DELETE CONVERSATION ──────────────────────────────────────────
  async deleteConversation(userId: string, conversationId: string) {
    await this.prisma.aIConversation.deleteMany({
      where: { id: conversationId, userId },
    });
    return { success: true, message: 'Conversation deleted' };
  }

  // ─── CLEAR ALL CONVERSATIONS ──────────────────────────────────────
  async clearAllConversations(userId: string) {
    await this.prisma.aIConversation.deleteMany({
      where: { userId },
    });
    return { success: true, message: 'All conversations cleared' };
  }

  // ─── QUICK ANSWER (no history) ────────────────────────────────────
  // For simple one-off questions — saves tokens
  async quickAnswer(question: string) {
    try {
      const result   = await this.model.generateContent(question);
      const response = await result.response;

      return {
        success: true,
        answer:  response.text(),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Quick answer error:', message);
      throw new BadRequestException('Failed to get answer. Please try again.');
    }
  }
}