import { PartialType } from '@nestjs/mapped-types';
import { CreateMicrorrutaDto } from './create-microrruta.dto';

export class UpdateMicrorrutaDto extends PartialType(CreateMicrorrutaDto) {}
