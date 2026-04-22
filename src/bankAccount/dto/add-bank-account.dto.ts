import {
  IsString,
  IsNotEmpty,
  Length,
  IsBoolean,
  IsOptional,
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
export class AddBankAccountDto {
  @ApiProperty({
    description : "BankName",
    example : "Access Bank"
  })
  @IsString()
  @IsNotEmpty()
  bankName: string; // e.g. "Access Bank"


  @ApiProperty({
    description : "BankCode",
    example : "044"
  })
  @IsString()
  @IsNotEmpty()
  bankCode: string; // e.g. "044"


  @ApiProperty({
    description : "AccountNumber",
    example : "1234567890"
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: "Account number must be exactly 10 digits" })
  @Matches(/^\d+$/, { message: "Account number must contain only digits" })
  accountNumber: string;

  @ApiProperty({
    description : "Account Name",
    example : "Mcagbriel okurishi"
  })
  @IsString()
  @IsNotEmpty()
  accountName: string; // verified account name from name enquiry

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
