import { Controller, Get, Post, Body, UseGuards, Res } from '@nestjs/common';
import { MailService } from './mail.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { Response } from 'express';

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
      orderBy: { createdAt: 'desc' },
    });
  }

  // 2. Endpoint para descargar el archivo Excel (ahora usa el servicio)
  @UseGuards(JwtAuthGuard)
  @Get('export_excel')
  async exportarExcel(@Res() res: Response) {
    try {
      const buffer = await this.mailService.exportLeadsToExcel();

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
