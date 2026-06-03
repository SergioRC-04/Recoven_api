import { Injectable } from '@nestjs/common';
import { CreateLeadDto } from './dto/create-lead.dto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

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
}
