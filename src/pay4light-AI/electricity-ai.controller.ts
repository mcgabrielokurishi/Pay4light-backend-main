import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';
import { AiService } from 'src/pay4light-AI/electricity-ai.service';
import { ChatDto } from 'src/pay4light-AI/dto/ai.dto';
// import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}


  @Post('chat')
  async chat(@Req() req: any, @Body() dto: ChatDto) {
    const userId = req.user?.id || dto.userId;

    return this.aiService.chat(userId, dto);
  }


  @Get('conversation/:id')
  async getConversation(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id;

    return this.aiService['prisma'].aIConversation.findFirst({
      where: { id, userId },
    });
  }



  @Post('conversation/delete/:id')
  async deleteConversation(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id;

    await this.aiService['prisma'].aIConversation.deleteMany({
      where: { id, userId },
    });

    return { success: true, message: 'Conversation deleted' };
  }
}