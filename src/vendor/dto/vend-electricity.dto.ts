import { IsString, IsNumber } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VendElectricityDto {
  @ApiProperty({ example: "0123456789" })
  @IsString()
  meterId: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  amount: number;
}
