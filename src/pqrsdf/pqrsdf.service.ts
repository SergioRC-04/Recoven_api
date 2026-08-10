import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { CreatePqrsdfDto } from './dto/create-pqrsdf.dto';
import { SearchPqrsdfDto } from './dto/search-pqrsdf.dto';
import { UpdatePqrsdfStatusDto } from './dto/update-pqrsdf.dto';
import { randomBytes } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class PqrsdfService {
  private supabase: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error(
        'Faltan SUPABASE_URL o SUPABASE_KEY en las variables de entorno',
      );
    }
    this.supabase = createClient<any, 'public', 'public'>(url, key);
  }

  private generateRadicado(): string {
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const randomHex = randomBytes(2).toString('hex').toUpperCase();
    return `PQRS-${yearMonth}-${randomHex}`;
  }

  private async uploadToSupabase(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    try {
      const timestamp = Date.now();
      const extension = file.originalname.split('.').pop();
      const nombreUnico = `${folder}/${timestamp}-${randomBytes(3).toString('hex')}.${extension}`;
      const bucketName = process.env.SUPABASE_BUCKET || 'certificados';

      const { error } = await this.supabase.storage
        .from(bucketName)
        .upload(nombreUnico, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) throw new Error(error.message);

      const { data: publicUrlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(nombreUnico);

      return publicUrlData.publicUrl;
    } catch (storageError) {
      console.error('Error al subir a Supabase:', storageError);
      throw new BadRequestException(
        'No se pudo almacenar el archivo adjunto en el servidor.',
      );
    }
  }

  async create(dto: CreatePqrsdfDto, file?: Express.Multer.File) {
    const radicado = this.generateRadicado();
    let urlArchivo: string | undefined = undefined;

    if (file) {
      urlArchivo = await this.uploadToSupabase(file, 'pqrsdf-peticionarios');
    }

    const nuevaPqrsdf = await this.prisma.pqrsdf.create({
      data: {
        ...dto,
        radicado,
        urlArchivo,
      },
    });

    const fechaRadicacion = nuevaPqrsdf.createdAt.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 1. Correo de confirmación para el solicitante
    const mailToUser = this.mailService.sendMail({
      to: dto.email,
      subject: `Confirmación de Radicado PQRSDF: ${radicado}`,
      html: `
        <p><strong>Confirmación de Radicado</strong></p>
        <p>Barranquilla, Atlántico., ${fechaRadicacion}</p>
        <p>Estimado(a):<br>
        <strong>${dto.nombreCompleto}</strong></p>
        <p><strong>Radicado N°.:</strong> ${radicado}<br>
        <strong>Asunto:</strong> ${dto.asunto}</p>
        <p>Queremos contarle que su solicitud ha sido radicada con éxito. Puede consultar el estado de su trámite en cualquier momento desde nuestro portal web ingresando su número de radicado y número de identificación.</p>
        <p>Este mensaje es automático por favor no responderlo.</p>
      `,
    });

    // 2. Correo de alerta interna para el equipo administrativo de RECOVEN
    const companyEmail = process.env.MAIL_ADMIN_RECEIVER;
    const mailToCompany = this.mailService.sendMail({
      to: companyEmail!,
      subject: `🚨 [NUEVO PQRSDF] Radicado N°: ${radicado} - ${dto.tipo}`,
      html: `
        <h2>Se ha recibido una nueva solicitud en el portal</h2>
        <p><strong>Radicado:</strong> ${radicado}</p>
        <p><strong>Tipo:</strong> ${dto.tipo}</p>
        <p><strong>Fecha de Radicación:</strong> ${fechaRadicacion}</p>
        <hr>
        <h3>Datos del Peticionario</h3>
        <ul>
          <li><strong>Nombre:</strong> ${dto.nombreCompleto}</li>
          <li><strong>Documento:</strong> ${dto.tipoIdentificacion} ${dto.numeroIdentificacion}</li>
          <li><strong>Correo:</strong> ${dto.email}</li>
          <li><strong>Teléfono:</strong> ${dto.telefono || 'No especificado'}</li>
          <li><strong>Dirección:</strong> ${dto.direccion || 'No especificada'}</li>
        </ul>
        <hr>
        <h3>Detalle de la Solicitud</h3>
        <p><strong>Asunto:</strong> ${dto.asunto}</p>
        <p><strong>Descripción:</strong></p>
        <blockquote style="background: #f9f9f9; padding: 10px; border-left: 4px solid #0056b3;">
          ${dto.descripcion}
        </blockquote>
        ${
          urlArchivo
            ? `<p><strong>Adjunto del Peticionario:</strong> <a href="${urlArchivo}" target="_blank">Ver Archivo Adjunto</a></p>`
            : '<p><em>No se adjuntaron archivos.</em></p>'
        }
        <hr>
        <p>Por favor ingresa al <a href="https://recovenesp.com/dashboard">Panel de Administración</a> para revisar y gestionar este radicado.</p>
      `,
    });

    // Enviamos ambos correos en paralelo de forma asíncrona
    try {
      await Promise.allSettled([mailToUser, mailToCompany]);
    } catch (error) {
      console.error('Error enviando notificaciones por correo:', error);
    }

    return {
      message: 'Solicitud radicada exitosamente',
      radicado: nuevaPqrsdf.radicado,
      fechaRadicacion: nuevaPqrsdf.createdAt,
    };
  }

  async searchStatus(dto: SearchPqrsdfDto) {
    const pqrsdf = await this.prisma.pqrsdf.findFirst({
      where: {
        radicado: dto.radicado.trim().toUpperCase(),
        numeroIdentificacion: dto.numeroIdentificacion.trim(),
      },
      select: {
        radicado: true,
        tipo: true,
        estado: true,
        asunto: true,
        createdAt: true,
        updatedAt: true,
        respuesta: true,
        urlRespuesta: true, // <-- Retornamos también la respuesta adjunta si existe
        fechaRespuesta: true,
      },
    });

    if (!pqrsdf) {
      throw new NotFoundException(
        'No se encontró ningún radicado con los datos proporcionados.',
      );
    }

    return pqrsdf;
  }

  async findAllAdmin() {
    return this.prisma.pqrsdf.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateStatus(
    id: string,
    dto: UpdatePqrsdfStatusDto,
    file?: Express.Multer.File,
  ) {
    const pqrsdf = await this.prisma.pqrsdf.findUnique({
      where: { id },
    });

    if (!pqrsdf) {
      throw new NotFoundException('La PQRSDF especificada no existe.');
    }

    let urlRespuesta: string | undefined = undefined;
    if (file) {
      urlRespuesta = await this.uploadToSupabase(file, 'pqrsdf-respuestas');
    }

    const dataToUpdate: Prisma.PqrsdfUpdateInput = {
      estado: dto.estado,
    };

    if (dto.respuesta) {
      dataToUpdate.respuesta = dto.respuesta;
      dataToUpdate.fechaRespuesta = new Date();
    }

    if (urlRespuesta) {
      dataToUpdate.urlRespuesta = urlRespuesta;
    }

    const actualizada = await this.prisma.pqrsdf.update({
      where: { id },
      data: dataToUpdate,
    });

    try {
      await this.mailService.sendMail({
        to: actualizada.email,
        subject: `Actualización de trámite PQRSDF: ${actualizada.radicado}`,
        html: `
          <h2>Novedad en su solicitud</h2>
          <p>Estimado(a) <strong>${actualizada.nombreCompleto}</strong>,</p>
          <p>Le informamos que su solicitud con radicado <strong>${actualizada.radicado}</strong> ha cambiado al estado: <strong style="color: #10b981;">${actualizada.estado}</strong>.</p>
          ${actualizada.respuesta ? `<p><strong>Respuesta / Observación:</strong> ${actualizada.respuesta}</p>` : ''}
          ${
            actualizada.urlRespuesta
              ? `<p><a href="${actualizada.urlRespuesta}" target="_blank">Descargar Documento Oficial de Respuesta</a></p>`
              : ''
          }
          <p>Puede consultar el detalle actualizado en nuestro portal web.</p>
        `,
      });
    } catch (error) {
      console.error('Error al enviar actualización por correo:', error);
    }

    return actualizada;
  }
}
