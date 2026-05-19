import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description :'current password',
    example : 'P@ssw0rd'
  })
  @IsString()
  currentPassword: string;
  
  @ApiProperty({
    description : 'new-password',
    example : 'newP@ssw0ord'
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message: 'New password must contain uppercase, number and symbol',
  })
  newPassword: string;
}