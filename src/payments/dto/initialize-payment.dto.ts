import { IsEmail, IsNumber, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class InitializePaymentDto {
  @ApiProperty({ example: "user@gmail.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(100)
  amount: number;
}