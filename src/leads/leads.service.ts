import { Injectable } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import ExcelJS from 'exceljs';

@Injectable()
export class LeadsService {
  constructor(
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll() {
    return this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });
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
    await this.mailService.sendMail({
      to: process.env.MAIL_ADMIN_RECEIVER!,
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
              <img src="https://recovenesp.com/assets/img/logo.png" alt="RECOVEN Logo" style="width: 140px;" />
              <p style="font-size: 11px; color: #9ca3af;">Este es un correo automático generado desde la Landing Page</p>
            </div>
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
    return Buffer.from(buffer);
  }
}
