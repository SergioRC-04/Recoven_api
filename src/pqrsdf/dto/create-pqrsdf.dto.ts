import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
} from 'class-validator';
import { TipoPqrsdf } from '@prisma/client';

export class CreatePqrsdfDto {
  @IsEnum(TipoPqrsdf)
  @IsNotEmpty()
  tipo: TipoPqrsdf;

  @IsString()
  @IsNotEmpty()
  nombreCompleto: string;

  @IsString()
  @IsNotEmpty()
  tipoIdentificacion: string;

  @IsString()
  @IsNotEmpty()
  numeroIdentificacion: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsString()
  @IsNotEmpty()
  asunto: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsOptional()
  urlArchivo?: string;
}
