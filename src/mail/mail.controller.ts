import { Controller, Get, Post, Body, UseGuards, Res } from '@nestjs/common';
import { MailService } from './mail.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { Response } from 'express';
import ExcelJS from 'exceljs';

@Controller('leads')
export class MailController {
  constructor(
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('send-lead')
  async sendLeadNotification(@Body() createLeadDto: CreateLeadDto) {
    await this.mailService.sendLeadEmail(createLeadDto);
    return { success: true, message: 'Solicitud enviada correctamente.' };
  }

  // 1. Endpoint para ver los leads en una tabla del Frontend Admin
  @UseGuards(JwtAuthGuard)
  @Get('')
  async obtenerLeads() {
    return await this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' }, // Los más recientes primero
    });
  }

  // 2. Endpoint para descargar el archivo Excel
  @UseGuards(JwtAuthGuard)
  @Get('export_excel')
  async exportarExcel(@Res() res: Response) {
    // Buscar todos los leads de la DB
    const leads = await this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Importamos exceljs dinámicamente o de forma estándar
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leads RECOVEN');

    // Definir las columnas del Excel con sus anchos
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

    // Darle un diseño básico a la fila del encabezado (Negrita y color gris claro)
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEAEAEA' },
    };

    // Llenar las filas con los datos de SQLite
    leads.forEach((lead) => {
      worksheet.addRow({
        id: lead.id,
        fecha: lead.createdAt.toISOString().split('T')[0], // Formato YYYY-MM-DD
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

    // Configurar las cabeceras HTTP para indicarle al navegador que es un archivo descargable
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' +
        `Leads_RECOVEN_${new Date().getFullYear()}.xlsx`,
    );

    // Escribir el archivo directamente en la respuesta HTTP
    await workbook.xlsx.write(res);
    res.end();
  }
}
