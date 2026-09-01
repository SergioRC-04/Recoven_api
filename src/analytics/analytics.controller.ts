import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
  Res,
  Delete,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { UpdateMetricDto } from './dto/update-metric.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { Response } from 'express';
import { DeleteMetricDto } from './dto/delete-metric.dto';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('metrics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @SkipThrottle()
  @Get('')
  async getAllMetrics() {
    return await this.analyticsService.getMetrics();
  }

  @UseGuards(JwtAuthGuard)
  @Put('')
  async updateMetric(@Body() updateMetricDto: UpdateMetricDto) {
    return await this.analyticsService.updateOrCreateMetric(updateMetricDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('')
  async deleteMetric(@Body() deleteMetricDto: DeleteMetricDto) {
    return await this.analyticsService.deleteMetric(deleteMetricDto);
  }

  // Ya no genera nada en el momento de la llamada — solo descarga el PDF
  // que quedó guardado en Supabase Storage la última vez que se creó,
  // editó o eliminó una métrica. Mismas cabeceras de siempre, mismo
  // comportamiento de descarga directa para el cliente.
  @Get('export_pdf')
  async descargarPdfReporte(@Res() res: Response) {
    const pdfBuffer = await this.analyticsService.obtenerReportePdfAlmacenado();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        'attachment; filename=Reporte_Historico_RECOVEN.pdf',
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
