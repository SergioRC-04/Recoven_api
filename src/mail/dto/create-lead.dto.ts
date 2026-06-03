import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  telefono: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email: string;

  @IsString()
  @IsOptional()
  empresa?: string; // Opcional

  @IsString()
  @IsOptional()
  direccion?: string; // Opcional

  @IsString()
  @IsNotEmpty({ message: 'El tipo de servicio es obligatorio' })
  servicio: string;

  @IsString()
  @IsOptional()
  especialidad?: string; // Opcional

  @IsString()
  @IsOptional()
  mensaje?: string; // Opcional
}
