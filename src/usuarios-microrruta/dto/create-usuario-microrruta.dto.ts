// dto/create-usuario-microrruta.dto.ts
import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateUsuarioMicrorrutaDto {
  @IsString()
  @IsNotEmpty()
  direccion: string;

  @IsString()
  @IsNotEmpty()
  poliza: string;

  @IsString()
  @MaxLength(500)
  detalles: string;

  @IsInt()
  microrrutaId: number;
}
