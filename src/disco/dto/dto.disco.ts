import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNumber } from "class-validator";

export class DiscoDto {
  @ApiProperty({
    description: "Name of the electricity distribution company",
    example: "Ikeja Electric",
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: "Unique code identifier for the Disco",
    example: "IKEDC",
  })
  @IsString()
  discoCode: string;

  @ApiProperty({
    description: "Comma-separated list of states covered by the Disco",
    example: "Lagos,Ogun",
  })
  @IsString()
  states: string;

  @ApiProperty({
    description: "Tariff rate charged by the Disco",
    example: 45.5,
  })
  @IsNumber()
  tariffRate: number;

  @ApiProperty({
    description: "Customer support phone number",
    example: "+234-800-123-4567",
  })
  @IsString()
  supportPhone: string;

  @ApiProperty({
    description: "Customer support email address",
    example: "support@ikejaelectric.com",
  })
  @IsString()
  supportEmail: string;

  @ApiProperty({
    description: "Official website of the Disco",
    example: "https://www.ikejaelectric.com",
  })
  @IsString()
  website: string;

  constructor(partial: Partial<DiscoDto>) {
    Object.assign(this, partial);
  }
}
