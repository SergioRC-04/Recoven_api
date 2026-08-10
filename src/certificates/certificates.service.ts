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
    // Inicializamos el cliente de Supabase con las variables de entorno
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key)
      throw new Error(
        'Faltan SUPABASE_URL o SUPABASE_KEY en las variables de entorno',
      );
    this.supabase = createClient<any, 'public', 'public'>(url, key);
  }

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

    // 2. Subir el archivo a Supabase Storage
    let urlArchivoPublica = '';
    try {
      // Creamos un nombre de archivo único para evitar colisiones en el bucket
      const timestamp = Date.now();
      const extension = file.originalname.split('.').pop();
      const nombreUnico = `${timestamp}-${dto.empresaId}.${extension}`;

      const bucketName = process.env.SUPABASE_BUCKET || 'certificados';

      // Subida del buffer a Supabase
      const { error } = await this.supabase.storage
        .from(bucketName)
        .upload(nombreUnico, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        throw new Error(error.message);
      }

      // Obtener la URL pública del archivo recién subido
      const { data: publicUrlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(nombreUnico);

      urlArchivoPublica = publicUrlData.publicUrl;
    } catch (storageError) {
      console.error('Error al subir a Supabase:', storageError);
      throw new BadRequestException(
        'No se pudo almacenar el archivo en el servidor de almacenamiento.',
      );
    }

    // 3. Registrar el envío en el historial de la DB (Neon) incluyendo la URL
    await this.prisma.certificados.create({
      data: {
        empresaId: dto.empresaId,
        tipo: dto.tipo,
        nombreArchivo: file.originalname,
        urlArchivo: urlArchivoPublica, // <-- Guardamos la URL de Supabase
      },
    });

    // 4. Envío directo del Correo Electrónico pasando la URL pública para el QR
    try {
      await this.mailService.sendCertificateEmail(
        empresa.correo,
        empresa.nombre,
        dto.tipo,
        file,
        urlArchivoPublica, // <-- NUEVO: Pasamos la URL pública de Supabase
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
        'Certificado registrado e inmediatamente enviado al correo del cliente con éxito.',
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
