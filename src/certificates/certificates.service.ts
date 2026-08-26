import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UploadCertificateDto } from './dto/upload-certificate.dto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class CertificatesService {
  private supabase: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key)
      throw new Error(
        'Faltan SUPABASE_URL o SUPABASE_KEY en las variables de entorno',
      );
    this.supabase = createClient<any, 'public', 'public'>(url, key);
  }

  async uploadAndSend(dto: UploadCertificateDto, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'El archivo de certificado es obligatorio.',
      );
    }

    const empresa = await this.prisma.empresasClientes.findUnique({
      where: { id: dto.empresaId },
    });
    if (!empresa) {
      throw new NotFoundException(
        'La empresa seleccionada no existe en la base de datos.',
      );
    }

    // El registro se crea ANTES de cualquier paso riesgoso (subida a
    // Supabase, envío de correo), en estado PENDIENTE. Antes, si la subida
    // o el envío fallaban, no quedaba ningún registro en la base de datos
    // — este era exactamente el problema reportado.
    const registro = await this.prisma.certificados.create({
      data: {
        empresaId: dto.empresaId,
        tipo: dto.tipo,
        nombreArchivo: file.originalname,
        estado: 'PENDIENTE',
      },
    });

    try {
      const bucketName = process.env.SUPABASE_BUCKET || 'certificados';
      const timestamp = Date.now();
      const extension = file.originalname.split('.').pop();
      const nombreUnico = `${timestamp}-${dto.empresaId}.${extension}`;

      const { error: uploadError } = await this.supabase.storage
        .from(bucketName)
        .upload(nombreUnico, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });
      if (uploadError) {
        throw new Error(`Supabase Storage: ${uploadError.message}`);
      }

      const { data: publicUrlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(nombreUnico);
      const urlArchivoPublica = publicUrlData.publicUrl;

      await this.mailService.sendCertificateEmail(
        empresa.correo,
        empresa.nombre,
        dto.tipo,
        file,
        urlArchivoPublica,
      );

      await this.prisma.certificados.update({
        where: { id: registro.id },
        data: { estado: 'ENVIADO', urlArchivo: urlArchivoPublica },
      });

      return {
        success: true,
        message:
          'Certificado registrado e inmediatamente enviado al correo del cliente con éxito.',
      };
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error desconocido';

      // Se marca el intento como fallido en vez de dejarlo huérfano en
      // PENDIENTE. Si esta actualización también fallara, no se relanza —
      // ya se va a notificar por correo de todas formas, y no queremos
      // perder ese aviso por un segundo error en cascada.
      await this.prisma.certificados
        .update({
          where: { id: registro.id },
          data: { estado: 'FALLIDO', errorDetalle: mensaje },
        })
        .catch((updateError) => {
          console.error(
            'No se pudo marcar el certificado como fallido:',
            updateError,
          );
        });

      await this.mailService.notifyAdminError(
        'Error enviando certificado',
        error,
        {
          empresa: empresa.nombre,
          correo: empresa.correo,
          tipo: dto.tipo,
          certificadoId: registro.id,
        },
      );

      throw new BadRequestException(
        `No se pudo completar el envío del certificado a ${empresa.nombre}. El intento quedó registrado como fallido y se notificó por correo.`,
      );
    }
  }

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
