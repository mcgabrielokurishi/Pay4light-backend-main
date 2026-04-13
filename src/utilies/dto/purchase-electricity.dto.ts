import { IsString, IsNumber, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class PurchaseElectricityDto {
  @ApiProperty({ example: "IBEDC" })
  @IsString()
  disco: string;

  @ApiProperty({ example: "0123456789" })
  @IsString()
  meterNumber: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(100)
  amount: number;
}
