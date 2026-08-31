import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  IsUrl,
  MaxLength,
  Matches,
} from 'class-validator';
import { TipoPqrsdf } from '@prisma/client';
import { Trim } from '../../common/decorators/trim.decorator';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';

// Refleja exactamente los valores permitidos en el <select> de PqrsdfForm.tsx
export enum TipoIdentificacion {
  CC = 'CC',
  NIT = 'NIT',
  CE = 'CE',
  PASAPORTE = 'Pasaporte',
}

export class CreatePqrsdfDto {
  @IsEnum(TipoPqrsdf, { message: 'El tipo de solicitud no es válido' })
  @IsNotEmpty({ message: 'El tipo de solicitud es obligatorio' })
  tipo: TipoPqrsdf;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo o razón social es obligatorio' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres' })
  nombreCompleto: string;

  @IsEnum(TipoIdentificacion, {
    message: 'El tipo de identificación no es válido',
  })
  @IsNotEmpty({ message: 'El tipo de identificación es obligatorio' })
  tipoIdentificacion: TipoIdentificacion;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El número de identificación es obligatorio' })
  @MaxLength(30, { message: 'El número de identificación es demasiado largo' })
  // Permite números, letras, puntos y guiones (cubriendo Cédulas, Pasaportes y NITs)
  @Matches(/^[a-zA-Z0-9.-]+$/, {
    message: 'El número de identificación contiene caracteres no válidos',
  })
  numeroIdentificacion: string;

  @NormalizeEmail()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;

  @Trim()
  @IsString()
  @IsOptional()
  @Matches(/^\+?[0-9\s-]{7,15}$/, {
    message: 'El formato de teléfono no es válido',
  })
  telefono?: string;

  @Trim()
  @IsString()
  @IsOptional()
  @MaxLength(200, {
    message: 'La dirección no puede superar los 200 caracteres',
  })
  direccion?: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El asunto es obligatorio' })
  @MaxLength(150, { message: 'El asunto no puede superar los 150 caracteres' })
  asunto: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(3000, {
    message: 'La descripción no puede superar los 3000 caracteres',
  })
  descripcion: string;

  @Trim()
  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'La URL del archivo no tiene un formato válido' })
  urlArchivo?: string;
}
