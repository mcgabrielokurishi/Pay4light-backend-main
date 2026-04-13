import { IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({
    example: "user@example.com or +2347012345678",
    description: "Email or phone number",
  })
  @IsString()
  identifier: string;



  @ApiProperty({
    example: "P@ssw0rd1",
  })
  @IsString()
  password: string;
}
