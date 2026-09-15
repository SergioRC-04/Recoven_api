import { PartialType } from '@nestjs/mapped-types';
import { CreateUsuarioMicrorrutaDto } from './create-usuario-microrruta.dto';

export class UpdateUsuarioMicrorrutaDto extends PartialType(
  CreateUsuarioMicrorrutaDto,
) {}
