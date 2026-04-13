
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryDiscoDto {
  @IsOptional()
  @IsString()
  state?: string; // filter by state e.g "Lagos"

  @IsOptional()
  @IsString()
  search?: string; // search by name or code

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}