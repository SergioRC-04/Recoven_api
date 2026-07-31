import { LeadsService } from './leads.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Controller, UseGuards, Get, Post, Body, Res } from '@nestjs/common';
import { CreateLeadDto } from './dto/create-lead.dto';
import type { Response } from 'express';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // 1. Endpoint para ver los leads en una tabla del Frontend Admin
  @UseGuards(JwtAuthGuard)
  @Get('')
  async obtenerLeads() {
    return this.leadsService.findAll();
  }

  // 2. Endpoint para enviar notificación de nuevo lead al correo administrativo
  @Post('send-lead')
  async sendLeadNotification(@Body() createLeadDto: CreateLeadDto) {
    await this.leadsService.sendLeadEmail(createLeadDto);
    return { success: true, message: 'Solicitud enviada correctamente.' };
  }

  // 3. Endpoint para descargar el archivo Excel (ahora usa el servicio)
  @UseGuards(JwtAuthGuard)
  @Get('export_excel')
  async exportarExcel(@Res() res: Response) {
    try {
      const buffer = await this.leadsService.exportLeadsToExcel();

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Leads_RECOVEN_${new Date().getFullYear()}.xlsx`,
      );

      res.send(buffer);
    } catch {
      res.status(500).json({
        success: false,
        message: 'Error al generar el archivo Excel',
      });
    }
  }
}
