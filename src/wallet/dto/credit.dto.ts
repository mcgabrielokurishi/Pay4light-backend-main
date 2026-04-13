import { IsNotEmpty, IsNumber, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreditWalletDto {

  @ApiProperty({ description: "Amount to credit" })
  @IsNumber()
  @IsNotEmpty()
  amount: number;
}