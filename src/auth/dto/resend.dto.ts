import { IsNotEmpty, IsString } from 'class-validator';

export class Resend2FADto {
  @IsString()
  @IsNotEmpty()
  username: string;
}
