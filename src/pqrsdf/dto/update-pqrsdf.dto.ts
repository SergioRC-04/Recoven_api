import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EstadoPqrsdf } from '@prisma/client';

export class UpdatePqrsdfStatusDto {
  @IsEnum(EstadoPqrsdf)
  @IsNotEmpty()
  estado: EstadoPqrsdf;

  @IsString()
  @IsOptional()
  respuesta?: string;
}
