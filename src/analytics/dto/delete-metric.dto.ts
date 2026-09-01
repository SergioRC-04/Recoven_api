import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class DeleteMetricDto {
  @IsString()
  @IsNotEmpty()
  sede: string;

  @IsString()
  @IsNotEmpty()
  mes: string;

  @IsNumber()
  @IsNotEmpty()
  year: number;
}
