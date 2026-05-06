// src/payment/dto/add-card.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AddCardDto {
  @ApiProperty({
    description : "the verification code for paystack",
    example :"123456"
  })
  @IsString()
  @IsNotEmpty()
  authorization_code: string; 
}