// src/ai/dto/chat.dto.ts
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatDto {
  @ApiProperty({
    description: 'The message content sent by the user',
    maxLength: 2000,
    example: 'Hello, how are you?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000, { message: 'Message too long — max 2000 characters' })
  message: string;

  @ApiPropertyOptional({
    description: 'Unique identifier for the conversation',
    example: 'abc123',
  })
  @IsString()
  @IsOptional()
  conversationId?: string;
}

export class QuickAnswerDto {
  @ApiProperty({
    description: 'question',
    example: 'Hello',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({
    description: 'The quick answer text',
    example: 'Yes',
  })
  @IsString()
  @IsNotEmpty()
  answer: string;
}
