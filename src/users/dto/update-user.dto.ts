import { IsOptional, IsString, IsEnum ,isEmail, IsEmail} from "class-validator";

export enum MeterType {
  PREPAID = "PREPAID",
  POSTPAID = "POSTPAID",
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
  
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEnum(MeterType)
  meterType?: MeterType;

  @IsOptional()
  @IsString()
  meterNumber?: string;

 @IsOptional()
  @IsEmail()
  email?: string;
  
  @IsOptional()
  @IsString()
  phone?: string;
}