// dto/create-microrruta.dto.ts
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ModalidadMicrorruta } from '@prisma/client';

export class CreateMicrorrutaDto {
  @IsString()
  nombre: string;

  @IsNumber()
  tipo: number;

  // Independiente de `tipo` (catálogo de actividad del SUI) — a pie o en
  // camión. Opcional: si no viene, cae al default de la BD (A_PIE), pero
  // el frontend siempre la manda (la decide la pestaña activa, no un
  // campo del formulario).
  @IsOptional()
  @IsEnum(ModalidadMicrorruta)
  modalidad?: ModalidadMicrorruta;

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
