import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class InitializePaymentDto {
  @ApiProperty({
    description : "amout to fund",
    example : "2000"
  })
  @IsNumber()
  @IsPositive()
  @Min(100, { message: 'Minimum amount is ₦100' })
  @Type(() => Number)
  amount: number; // in Naira

  @IsString()
  @IsOptional()
  callbackUrl?: string; // where to redirect after payment
}