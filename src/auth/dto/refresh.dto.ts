import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RefreshDto{
    @ApiProperty({ example: "<refresh-token>" })
    @IsString()
    refreshToken: string;
}
