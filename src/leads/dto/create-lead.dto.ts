import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
  Matches,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';

// 1. Definir Enums estrictos para las opciones fijas
export enum TipoServicio {
  RESIDENCIAL = 'Servicio Residencial',
  INDUSTRIAL_COMERCIAL = 'Servicio Industrial / Comercial',
}

export enum EspecialidadServicio {
  RESIDUOS = 'Gestión de Residuos Aprovechables',
  ABONOS = 'Abonos & Sostenibilidad',
  SANEAMIENTO = 'Saneamiento & Manejo Ambiental',
  PODA = 'Recolección y Disposición Final de Poda',
  INTEGRAL = 'Gestión Ambiental Integral',
  BERMAS = 'Limpieza y Mantenimiento de Bermas',
  OTROS = 'Otros',
}

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  @Trim()
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  // Acepta formatos estándar: +573000000000, 3000000000, 300 000 0000
  @Matches(/^\+?[0-9\s-]{7,15}$/, {
    message: 'El formato de teléfono no es válido',
  })
  telefono: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @NormalizeEmail()
  email: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  @Trim()
  empresa?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  @Trim()
  direccion?: string;

  // 2. Garantiza que solo entren valores exactos de la lista
  @IsEnum(TipoServicio, {
    message: 'El tipo de servicio seleccionado no es válido',
  })
  @IsNotEmpty({ message: 'El tipo de servicio es obligatorio' })
  servicio: TipoServicio;

  @IsEnum(EspecialidadServicio, {
    message: 'La especialidad seleccionada no es válida',
  })
  @IsOptional()
  especialidad?: EspecialidadServicio;

  @IsString()
  @IsOptional()
  @MaxLength(1000, {
    message: 'El mensaje no puede superar los 1000 caracteres',
  })
  @Trim()
  mensaje?: string;
}
