import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
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

  // Opcional. Dígitos, y opcionalmente +, espacios, paréntesis o guiones
  // (p. ej. "3001234567" o "+57 300 123 4567") — no se fuerza un formato
  // único. Un texto vacío se guarda como null (sin teléfono), así también
  // se puede borrar uno ya registrado al editar.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\s()-]{7,20}$/, {
    message: 'El teléfono debe tener entre 7 y 20 dígitos/caracteres válidos.',
  })
  telefono?: string | null;

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

  // Fecha de nacimiento y dirección: no se muestran en la tabla del
  // admin, solo se usan al imprimir los informes de Excel (la edad se
  // calcula ahí a partir de esta fecha, ver recyclers-export.util.ts).
  // Mismo patrón que fechaIngreso (string "YYYY-MM-DD"); a diferencia de
  // ese campo, un string vacío es válido aquí (se guarda como null en el
  // service — ver create()/update() en recyclers.service.ts).
  @IsOptional()
  @IsString()
  fechaNacimiento?: string;

  // Dirección de la casa (no de correo/correspondencia) — distinta de
  // detalleUbicacion, que es una aclaración sobre el barrio asignado.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

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
