import { Injectable } from '@nestjs/common';
import { CreateLeadDto } from './dto/create-lead.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { PrismaService } from '../prisma/prisma.service';
import ExcelJS from 'exceljs';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly prisma: PrismaService,
  ) {}

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

    // Guardar en Base de Datos
    await this.prisma.lead.create({
      data: {
        nombre,
        telefono,
        email,
        empresa,
        direccion,
        servicio,
        especialidad,
        mensaje,
      },
    });

    // Enviar notificación al correo administrativo de RECOVEN
    await this.mailerService.sendMail({
      to: process.env.MAIL_ADMIN_RECEIVER,
      from: process.env.MAIL_FROM,
      subject: `🔴 Nueva Solicitud de Servicio: ${servicio}`,
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
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <strong>Detalles/Mensaje adicional:</strong><br/>
            ${mensaje || 'Sin comentarios adicionales.'}
          </div>
          
          <br/>
          <hr style="border: 0; border-top: 1px solid #e5e7eb;" />
          <div style="text-align: center; margin-top: 15px;">
            <img src="https://landingpage-recoven.vercel.app/assets/img/logo.png" alt="RECOVEN Logo" style="width: 140px;" />
            <p style="font-size: 11px; color: #9ca3af;">Este es un correo automático generado desde la Landing Page</p>
          </div>
        </div>
      `,
    });
  }

  async sendSecurityCode(email: string, code: string) {
    await this.mailerService.sendMail({
      to: email, // Correo del administrador que intenta loguearse
      from: process.env.MAIL_FROM,
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

  async exportLeadsToExcel(): Promise<Buffer> {
    const leads = await this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leads RECOVEN');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Nombre', key: 'nombre', width: 25 },
      { header: 'Teléfono', key: 'telefono', width: 15 },
      { header: 'Correo Electrónico', key: 'email', width: 25 },
      { header: 'Empresa', key: 'empresa', width: 20 },
      { header: 'Dirección', key: 'direccion', width: 25 },
      { header: 'Servicio Solicitado', key: 'servicio', width: 20 },
      { header: 'Especialidad', key: 'especialidad', width: 20 },
      { header: 'Mensaje', key: 'mensaje', width: 40 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEAEAEA' },
    };

    leads.forEach((lead) => {
      worksheet.addRow({
        id: lead.id,
        fecha: lead.createdAt.toISOString().split('T')[0],
        nombre: lead.nombre,
        telefono: lead.telefono,
        email: lead.email,
        empresa: lead.empresa || 'N/A',
        direccion: lead.direccion || 'N/A',
        servicio: lead.servicio,
        especialidad: lead.especialidad || 'N/A',
        mensaje: lead.mensaje || 'Sin mensaje',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  async sendCertificateEmail(
    emailDestinatario: string,
    nombreEmpresa: string,
    tipo: 'PODA' | 'RESIDUOS',
    file: Express.Multer.File,
  ) {
    const esPoda = tipo === 'PODA';
    const subject = esPoda
      ? ' Certificado de Disposición Final de Residuos de Poda - RECOVEN ECA'
      : ' Certificado de Disposición Final de Residuos Diversos - RECOVEN ECA';

    const tituloCertificado = esPoda
      ? 'Certificado de Manejo y Disposición Final de Residuos Orgánicos Aprovechables'
      : 'Certificado de Manejo y Disposición Final de Residuos';

    const parrafoDetalle = esPoda
      ? 'correspondiente a las actividades de poda ejecutadas en las zonas de recolección autorizadas.'
      : 'correspondiente a los proyectos corporativos especiales y de materiales diversos procesados en nuestras plantas de clasificación.';

    await this.mailerService.sendMail({
      to: emailDestinatario, // Cliente final
      from: process.env.MAIL_FROM,
      subject: subject,
      html: `
        <div style="font-family: 'Inter', sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; line-height: 1.6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://landingpage-recoven.vercel.app/assets/img/logo.png" alt="RECOVEN Logo" style="width: 150px;" />
          </div>
          
          <h2 style="color: #059669; border-bottom: 2px solid #f3f4f6; padding-bottom: 12px; font-size: 20px;">
            Emisión de Certificado Ambiental Oficial
          </h2>
          
          <p>Estimado equipo de <strong>${nombreEmpresa}</strong>,</p>
          
          <p>Cordial saludo por parte de <strong>RECOVEN ECA SAS ESP</strong>.</p>
          
          <p>Adjunto a este mensaje encontrará el <strong>${tituloCertificado}</strong> ${parrafoDetalle}</p>
          
          <div style="background-color: #f9fafb; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #374151; font-weight: 500;">
              ℹ️ El documento oficial firmado ha sido anexado directamente a este correo electrónico como archivo adjunto para su descarga y almacenamiento local.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #6b7280;">
            Agradecemos su confianza en nuestros servicios orientados al desarrollo de la economía circular, la transformación ecológica y la gestión ambiental responsable bajo el estricto cumplimiento de la normativa legal vigente.
          </p>
          
          <br/>
          <hr style="border: 0; border-top: 1px solid #e5e7eb;" />
          
          <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
            <p style="margin: 0; font-weight: bold; color: #4b5563;">RECOVEN ECA SAS ESP</p>
            <p style="margin: 4px 0 0 0;">Barranquilla, Atlántico, Colombia</p>
            <p style="font-size: 11px; margin-top: 10px; color: #ca8a04;">⚠️ Por favor, no responda a este correo electrónico, es una notificación automatizada.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: file.originalname,
          content: file.buffer,
        },
      ],
    });
  }
}
