import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ClasificacionRecycler, TipoDocumento } from '@prisma/client';
import { NormalizeNombrePropio } from '../../common/decorators/normalize-nombre-propio.decorator';

export class CreateRecyclerDto {
  // Opcional: si se omite, Prisma aplica su propio default
  // (CEDULA_CIUDADANIA) — mismo criterio que censado/clasificacion, que
  // ya funcionan así.
  @IsOptional()
  @IsEnum(TipoDocumento)
  tipoDocumento?: TipoDocumento;

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

  // Aclaración libre además de los barrios asignados — p. ej. "Solo el
  // Conjunto Villa Alegre" o "Sector Juan Mina, no pertenece a ningún
  // barrio formal". Un solo campo general, no uno por cada barrio.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  detalleUbicacion?: string;

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
