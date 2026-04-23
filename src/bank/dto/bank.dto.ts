import {IsString,IsOptional} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'


export class BankQueryDto {


  @ApiProperty({
    description : "bank",
    example : "OPAY"
  })
  @IsOptional()
  @IsString() 
  search?: string;
}
