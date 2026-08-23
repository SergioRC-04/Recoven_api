import { PartialType } from '@nestjs/mapped-types';
import { CreateRecyclerDto } from './create-recycler.dto';

export class UpdateRecyclerDto extends PartialType(CreateRecyclerDto) {}
