import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

export class UploadCertificateDto {
  @IsUUID('4', { message: 'El ID de la empresa debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'Debe seleccionar una empresa destino.' })
  empresaId: string;

  @IsEnum(['PODA', 'RESIDUOS'], {
    message: 'El tipo debe ser PODA o RESIDUOS.',
  })
  @IsNotEmpty({ message: 'Debe especificar el tipo de certificado.' })
  tipo: 'PODA' | 'RESIDUOS';
}
