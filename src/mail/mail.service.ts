import { Injectable } from '@nestjs/common';
import { CreateLeadDto } from './dto/create-lead.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly prisma: PrismaService,
  ) {}

  getMail(): string {
    return 'Servicio de correo electrónico funcionando correctamente!';
  }

  async sendLeadEmail(data: CreateLeadDto) {
    const {
      nombre,
      telefono,
      email,
      empresa,
      direccion,
      servicio,
      especialidad,
      mensaje,
    } = data;

    // 1. Guardar primero en la base de datos SQLite
    await this.prisma.lead.create({
      data: {
        nombre: data.nombre,
        telefono: data.telefono,
        email: data.email,
        empresa: data.empresa,
        direccion: data.direccion,
        servicio: data.servicio,
        especialidad: data.especialidad,
        mensaje: data.mensaje,
      },
    });

    await this.mailerService.sendMail({
      to: 'srodriguezcabana@gmail.com', // El correo de prueba
      from: 'srodriguezcabana+prueba@gmail.com', // El correo de envío
      subject: `🚨 Nueva Solicitud de Servicio: ${servicio}`,
      // Usamos 'html' para estructurarlo de forma limpia e incluir la firma visual
      html: `
        <div style="font-family: 'Inter', sans-serif; color: #1f2937; max-width: 600px; line-height: 1.6;">
          <h2 style="color: #059669; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            Datos de la Solicitud
          </h2>
          <p><strong>Nombre completo:</strong> ${nombre}</p>
          <p><strong>Teléfono / WhatsApp:</strong> ${telefono}</p>
          <p><strong>Correo electrónico:</strong> ${email}</p>
          <p><strong>Empresa / Conjunto:</strong> ${empresa || 'No especificado'}</p>
          <p><strong>Dirección / Zona:</strong> ${direccion || 'No especificado'}</p>
          <p><strong>Tipo de Servicio:</strong> ${servicio}</p>
          <p><strong>Especialidad requerida:</strong> ${especialidad || 'Ninguna seleccionada'}</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; rounded: 8px; margin-top: 15px;">
            <strong>Detalles/Mensaje adicional:</strong><br/>
            ${mensaje || 'Sin comentarios adicionales.'}
          </div>
          
          <br/>
          <hr style="border: 0; border-top: 1px solid #e5e7eb;" />
          <!-- Ejemplo de imagen default adjunta (Incrustada por CID) -->
          <div style="text-align: center; margin-top: 15px;">
            <img src="https://landingpage-recoven.vercel.app/assets/img/logo.png" alt="RECOVEN Logo" style="width: 140px;" />
            <p style="font-size: 11px; color: #9ca3af;">Este es un correo automático generado desde la Landing Page</p>
          </div>
        </div>
      `,
    });
  }

  // FUNCIÓN: Exclusiva para el Segundo Factor de Autenticación (2FA)
  async sendSecurityCode(email: string, code: string) {
    await this.mailerService.sendMail({
      to: email,
      // Usamos el truco del '+' pero enfocado en seguridad para evitar el "yo"
      from: `"Seguridad RECOVEN" <srodriguezcabana+security@gmail.com>`,
      subject: '🔒 Código de verificación de seguridad - RECOVEN',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; max-width: 500px;">
          <h2 style="color: #111827; margin-bottom: 4px;">Control de Acceso</h2>
          <p style="color: #4b5563; font-size: 14px;">Se ha solicitado un inicio de sesión en el panel administrativo de RECOVEN.</p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <span style="font-size: 12px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Tu código de verificación</span>
            <h1 style="color: #10b981; margin: 8px 0 0 0; font-size: 32px; letter-spacing: 6px; font-family: monospace;">${code}</h1>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">Este código expirará en 5 minutos. Si no solicitaste este acceso, puedes ignorar este correo de forma segura.</p>
        </div>
      `,
    });
  }
}
