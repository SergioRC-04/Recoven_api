import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateMetricDto } from './dto/update-metric.dto';
import { DeleteMetricDto } from './dto/delete-metric.dto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generarReportePDF } from './utils/metrics-report.util';

@Injectable()
export class AnalyticsService {
  private supabase: SupabaseClient;

  // Misma ruta siempre — con upsert:true, cada regeneración sobrescribe
  // este único archivo en vez de acumular uno nuevo por cada cambio.
  private readonly REPORTE_PATH = 'reportes/reporte-historico-recoven.pdf';

  constructor(private readonly prisma: PrismaService) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error(
        'Faltan SUPABASE_URL o SUPABASE_KEY en las variables de entorno',
      );
    }
    this.supabase = createClient<any, 'public', 'public'>(url, key);
  }

  async getMetrics() {
    return await this.prisma.metric.findMany({
      orderBy: [{ year: 'asc' }, { id: 'asc' }],
    });
  }

  async updateOrCreateMetric(dto: UpdateMetricDto) {
    const { sede, mes, year, aprovechamiento, rechazo } = dto;
    const resultado = await this.prisma.metric.upsert({
      where: { sede_mes_year: { sede, mes, year } },
      update: { aprovechamiento, rechazo },
      create: { sede, mes, year, aprovechamiento, rechazo },
    });

    // Fire-and-forget: el admin no debe esperar a que se regeneren las
    // gráficas y se componga el PDF de nuevo solo para recibir la
    // confirmación de que su cambio se guardó. Si la regeneración falla,
    // queda en el log — el PDF almacenado simplemente se queda con los
    // datos anteriores hasta el próximo cambio exitoso.
    this.regenerarReporteAlmacenado().catch((err) =>
      console.error('Error regenerando el reporte PDF de métricas:', err),
    );

    return resultado;
  }

  async deleteMetric(dto: DeleteMetricDto) {
    const { sede, mes, year } = dto;
    try {
      const resultado = await this.prisma.metric.delete({
        where: { sede_mes_year: { sede, mes, year } },
      });

      this.regenerarReporteAlmacenado().catch((err) =>
        console.error('Error regenerando el reporte PDF de métricas:', err),
      );

      return resultado;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Métrica con sede "${sede}", mes "${mes}", año "${year}" no encontrada`,
        );
      }
      throw error;
    }
  }

  /**
   * Consulta las métricas actuales, compone el PDF (metrics-report.util.ts)
   * y lo sube a Supabase Storage en la ruta fija (REPORTE_PATH),
   * sobrescribiendo la versión anterior.
   */
  private async regenerarReporteAlmacenado(): Promise<void> {
    const metrics = await this.prisma.metric.findMany({
      orderBy: [{ year: 'asc' }, { sede: 'asc' }, { mes: 'asc' }],
    });
    const buffer = await generarReportePDF(metrics);
    const bucketName = process.env.SUPABASE_BUCKET || 'certificados';

    const { error } = await this.supabase.storage
      .from(bucketName)
      .upload(this.REPORTE_PATH, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(`No se pudo guardar el reporte PDF: ${error.message}`);
    }
  }

  /**
   * Descarga el PDF ya generado desde Supabase Storage — no genera nada
   * en el momento de la llamada. Si todavía no existe (nunca se ha creado
   * o editado ninguna métrica), lanza 404 con un mensaje explicativo.
   */
  async obtenerReportePdfAlmacenado(): Promise<Buffer> {
    const bucketName = process.env.SUPABASE_BUCKET || 'certificados';
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .download(this.REPORTE_PATH);

    if (error || !data) {
      throw new NotFoundException(
        'El reporte todavía no se ha generado. Crea o edita una métrica para generarlo.',
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
