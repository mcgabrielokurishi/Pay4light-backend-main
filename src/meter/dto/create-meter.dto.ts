import { IsString, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateMeterDto {
  @ApiProperty({
    description: "Unique meter number, between 11 and 13 characters",
    example: "58101399481",
  })
  @IsString()
  @Length(11, 13)
  meterNumber: string;

  @ApiProperty({
    description: "The electricity distribution company (Disco)",
    example: "ikeja",
  })
  @IsString()
  discoCode: string;

  @ApiProperty({
    description: "Type of meter (prepaid or postpaid)",
    example: "prepaid",
  })
  @IsString()
  meterType: string;

  @ApiProperty({
    description: "Custom name for the meter",
    example: "Home",
  })
  @IsString()
  meterName: string;
}
