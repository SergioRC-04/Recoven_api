import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateMetricDto {
  @IsString()
  @IsNotEmpty()
  sede: string; // "BARRANQUILLA" o "PUERTO_COLOMBIA"

  @IsString()
  @IsNotEmpty()
  mes: string;

  @IsNumber()
  aprovechamiento: number;

  @IsNumber()
  rechazo: number;
}
