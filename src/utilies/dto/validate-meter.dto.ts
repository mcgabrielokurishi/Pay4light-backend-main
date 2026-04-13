import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ValidateMeterDto {
  @ApiProperty({ example: "IBEDC" })
  @IsString()
  disco: string;

  @ApiProperty({ example: "0123456789" })
  @IsString()
  meterNumber: string;
}
