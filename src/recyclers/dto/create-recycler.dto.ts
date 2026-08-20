import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
} from 'class-validator';
import { ClasificacionRecycler } from '@prisma/client';

export class CreateRecyclerDto {
  @IsString()
  cedula: string;

  @IsString()
  nombreCompleto: string;

  @IsOptional()
  @IsBoolean()
  censado?: boolean;

  @IsOptional()
  @IsEnum(ClasificacionRecycler)
  clasificacion?: ClasificacionRecycler;

  @IsOptional()
  @IsArray()
  barriosIds?: string[];

  @IsOptional()
  @IsArray()
  microrrutasIds?: number[];
}
