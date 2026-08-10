import { IsNotEmpty, IsString } from 'class-validator';

export class SearchPqrsdfDto {
  @IsString()
  @IsNotEmpty()
  radicado: string;

  @IsString()
  @IsNotEmpty()
  numeroIdentificacion: string;
}
