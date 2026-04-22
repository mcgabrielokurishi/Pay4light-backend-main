import { IsString, IsNotEmpty, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class DeleteAccountDto {
   @ApiProperty({
      description : "Password",
      example : "P@ssw0rd"
    })
  @IsString()
  @IsNotEmpty()
  password: string; 

  @ApiProperty({
      description : "Reason",
      example : "Am moving to a new home"
    })
  @IsString()
  @IsOptional()
  reason?: string; 
}
