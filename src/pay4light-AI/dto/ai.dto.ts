import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ChatDto {
  @ApiProperty({
    description: 'The message content of the chat',
    example: 'Hello, how are you?',
  })
  @IsString()
  message!: string;

  @ApiProperty({
    description: 'The ID of the conversation',
    example: 'conv_123',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  // Only for testing without auth
  @ApiProperty({
    description: 'The ID of the user',
    example: 'user_123',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}