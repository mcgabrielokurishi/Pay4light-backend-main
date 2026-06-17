// src/ai/ai.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from './electricity-ai.service';
import { ChatDto,QuickAnswerDto } from './dto/ai.dto';


@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // ─── CHAT (with history) — protected ─────────────────────────────
  @Post('chat')
  @UseGuards(AuthGuard('jwt'))
  async chat(@Req() req: any, @Body() dto: ChatDto) {
    return this.aiService.chat(req.user.id, dto);
  }

  // ─── QUICK ANSWER — public (no auth, no history) ─────────────────
  // Good for FAQ page, landing page chatbot
  @Post('ask')
  async quickAnswer(@Body() dto: QuickAnswerDto) {
    return this.aiService.quickAnswer(dto.question);
  }

  // Add to ai.controller.ts temporarily
@Get('models')
async listModels() {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
  );
  const data: any = await response.json();
  return data?.models?.map((m: any) => ({
    name:               m.name,
    displayName:        m.displayName,
    supportedMethods:   m.supportedGenerationMethods,
  }));
}

  // ─── GET ALL CONVERSATIONS ────────────────────────────────────────
  @Get('conversations')
  @UseGuards(AuthGuard('jwt'))
  async getAllConversations(@Req() req: any) {
    const data = await this.aiService.getAllConversations(req.user.id);
    return {
      success: true,
      total:   data.length,
      data,
    };
  }

  // ─── GET ONE CONVERSATION ─────────────────────────────────────────
  @Get('conversations/:id')
  @UseGuards(AuthGuard('jwt'))
  async getConversation(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const data = await this.aiService.getConversation(req.user.id, id);
    return { success: true, data };
  }

  // ─── DELETE ONE CONVERSATION ──────────────────────────────────────
  @Delete('conversations/:id')
  @UseGuards(AuthGuard('jwt'))
  async deleteConversation(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.aiService.deleteConversation(req.user.id, id);
  }

  // ─── CLEAR ALL CONVERSATIONS ──────────────────────────────────────
  @Delete('conversations')
  @UseGuards(AuthGuard('jwt'))
  async clearAll(@Req() req: any) {
    return this.aiService.clearAllConversations(req.user.id);
  }
}