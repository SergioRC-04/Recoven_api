import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ClasificacionRecycler } from '@prisma/client';
import { NormalizeNombrePropio } from '../../common/decorators/normalize-nombre-propio.decorator';

export class CreateRecyclerDto {
  @IsString()
  @MaxLength(20)
  cedula: string;

  @NormalizeNombrePropio()
  @IsString()
  @MaxLength(60)
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

  @IsOptional()
  @IsString()
  fechaIngreso?: string; // ISO string, el front envía "YYYY-MM-DD"
}
