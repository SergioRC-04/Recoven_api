import { IsNotEmpty, IsString } from 'class-validator';

export class Verify2FADto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}
