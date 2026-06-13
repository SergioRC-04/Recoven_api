import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UploadCertificateDto } from './dto/upload-certificate.dto';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // Procesa la subida, registra en log y envía el correo directamente
  async uploadAndSend(dto: UploadCertificateDto, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'El archivo de certificado es obligatorio.',
      );
    }

    // 1. Validar que la empresa exista en la base de datos
    const empresa = await this.prisma.empresasClientes.findUnique({
      where: { id: dto.empresaId },
    });

    if (!empresa) {
      throw new NotFoundException(
        'La empresa seleccionada no existe en la base de datos.',
      );
    }

    // 2. Registrar el envío en el historial de la DB (Auditoría interna)
    await this.prisma.certificados.create({
      data: {
        empresaId: dto.empresaId,
        tipo: dto.tipo,
        nombreArchivo: file.originalname,
      },
    });

    // 3. Envío directo del Correo Electrónico adjuntando el buffer de memoria
    try {
      await this.mailService.sendCertificateEmail(
        empresa.correo,
        empresa.nombre,
        dto.tipo,
        file,
      );
    } catch (error) {
      console.error(`Error enviando correo a ${empresa.correo}:`, error);
      throw new BadRequestException(
        'El registro fue guardado pero no se pudo despachar el correo electrónico.',
      );
    }

    return {
      success: true,
      message:
        'Certificado registrado e inmendiatamente enviado al correo del cliente con éxito.',
    };
  }

  // Permite al Administrador visualizar qué certificados se han enviado
  async getHistory() {
    return this.prisma.certificados.findMany({
      include: {
        empresa: {
          select: {
            nombre: true,
            correo: true,
          },
        },
      },
      orderBy: {
        fechaEnvio: 'desc',
      },
    });
  }
}
