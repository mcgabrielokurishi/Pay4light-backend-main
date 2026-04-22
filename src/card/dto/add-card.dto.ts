import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Length,
  IsIn,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AddCardDto {
  @ApiProperty({ example: "tok_xxx123" })
  @IsString()
  @IsNotEmpty()
  cardToken: string;

  @ApiProperty({ example: "1234" })
  @IsString()
  @IsNotEmpty()
  @Length(4, 4)
  @Matches(/^\d+$/)
  last4: string;

  @ApiProperty({ example: "visa", enum: ["visa", "mastercard", "verve"] })
  @IsString()
  @IsNotEmpty()
  @IsIn(["visa", "mastercard", "verve"])
  brand: string;

  @ApiProperty({ example: "08" })
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  @Matches(/^(0[1-9]|1[0-2])$/)
  expMonth: string;

  @ApiProperty({ example: "2027" })
  @IsString()
  @IsNotEmpty()
  @Length(4, 4)
  expYear: string;

  @ApiPropertyOptional({ example: "John Doe" })
  @IsString()
  @IsOptional()
  cardHolderName?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}