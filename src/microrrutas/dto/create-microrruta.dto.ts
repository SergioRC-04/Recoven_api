// dto/create-microrruta.dto.ts
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateMicrorrutaDto {
  @IsString()
  nombre: string;

  @IsNumber()
  tipo: number;

  @IsOptional()
  @IsString()
  fechaOperacion?: string;

  @IsOptional()
  @IsString()
  dirInicio?: string;

  @IsOptional()
  @IsString()
  horaInicio?: string;

  @IsOptional()
  @IsString()
  dirFin?: string;

  @IsOptional()
  @IsString()
  horaFin?: string;

  @IsOptional()
  @IsNumber()
  distPavimentada?: number;

  @IsOptional()
  @IsNumber()
  distNoPavimentada?: number;

  @IsOptional()
  @IsNumber()
  frecuencia?: number;

  @IsOptional()
  @IsString()
  diasFrecuencia?: string;

  @IsOptional()
  @IsNumber()
  estacionTransferencia?: number;

  @IsOptional()
  @IsNumber()
  tipoBarrido?: number;

  // GeoJSON LineString emitido desde el cliente (OpenLayers)
  @IsOptional()
  geojson?: object;
}
