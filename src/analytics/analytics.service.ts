import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateMetricDto } from './dto/update-metric.dto';
import PDFDocument from 'pdfkit';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import chartJsDataLabels from 'chartjs-plugin-datalabels';
import { DeleteMetricDto } from './dto/delete-metric.dto';

// Función auxiliar para convertir el stream del PDF a Buffer
function streamToBuffer(stream: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    return await this.prisma.metric.findMany({
      orderBy: [{ year: 'asc' }, { id: 'asc' }],
    });
  }

  async updateOrCreateMetric(dto: UpdateMetricDto) {
    const { sede, mes, year, aprovechamiento, rechazo } = dto;
    return await this.prisma.metric.upsert({
      where: { sede_mes_year: { sede, mes, year } },
      update: { aprovechamiento, rechazo },
      create: { sede, mes, year, aprovechamiento, rechazo },
    });
  }

  async deleteMetric(dto: DeleteMetricDto) {
    const { sede, mes, year } = dto;
    try {
      return await this.prisma.metric.delete({
        where: { sede_mes_year: { sede, mes, year } },
      });
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

  async generarReportePDF(): Promise<Buffer> {
    const metrics = await this.prisma.metric.findMany({
      orderBy: [{ year: 'asc' }, { sede: 'asc' }, { mes: 'asc' }],
    });

    if (metrics.length === 0) {
      throw new Error('No hay métricas para generar el reporte');
    }

    const yearsAvailable = [...new Set(metrics.map((m) => m.year))].sort(
      (a, b) => a - b,
    );

    // Crear documento PDF
    const doc = new PDFDocument({ size: 'A4', margin: 0 });

    const chartCallback = (ChartJS: any) => {
      ChartJS.defaults.font.family = 'Helvetica';
      ChartJS.register(chartJsDataLabels);
    };

    for (let i = 0; i < yearsAvailable.length; i++) {
      const year = yearsAvailable[i];
      const metricsYear = metrics.filter((m) => m.year === year);
      const datosBq = metricsYear.filter((m) => m.sede === 'BARRANQUILLA');
      const datosPuerto = metricsYear.filter(
        (m) => m.sede === 'PUERTO COLOMBIA',
      );

      const todosMeses = [
        'Enero',
        'Febrero',
        'Marzo',
        'Abril',
        'Mayo',
        'Junio',
        'Julio',
        'Agosto',
        'Septiembre',
        'Octubre',
        'Noviembre',
        'Diciembre',
      ];

      const meses = todosMeses.filter(
        (mes) =>
          datosBq.some((d) => d.mes === mes) ||
          datosPuerto.some((d) => d.mes === mes),
      );

      const bqAprovechamiento = meses.map(
        (m) => datosBq.find((d) => d.mes === m)?.aprovechamiento || 0,
      );
      const bqRechazo = meses.map(
        (m) => datosBq.find((d) => d.mes === m)?.rechazo || 0,
      );
      const puertoAprovechamiento = meses.map(
        (m) => datosPuerto.find((d) => d.mes === m)?.aprovechamiento || 0,
      );
      const puertoRechazo = meses.map(
        (m) => datosPuerto.find((d) => d.mes === m)?.rechazo || 0,
      );

      const totalGeneral = metricsYear.reduce(
        (acc, cur) => acc + cur.aprovechamiento,
        0,
      );

      const chartWidth = 500;
      const chartHeight = Math.max(
        330,
        70 + meses.length * 22 + meses.length * 6,
      );
      const chartJSNodeCanvas = new ChartJSNodeCanvas({
        width: chartWidth,
        height: chartHeight,
        chartCallback,
      });

      const crearConfiguracionGrafico = (
        titulo: string,
        aprovechamientoData: number[],
        rechazoData: number[],
      ) => {
        const maxValor = Math.max(...aprovechamientoData, ...rechazoData);
        const maxConMargen = maxValor * 1.15;
        const stepSize = 20000;
        const maxRedondeado = Math.ceil(maxConMargen / stepSize) * stepSize;

        return {
          type: 'bar' as const,
          data: {
            labels: meses,
            datasets: [
              {
                label: 'Aprovechamiento (t)',
                data: aprovechamientoData,
                backgroundColor: '#10b981',
              },
              {
                label: 'Rechazo (t)',
                data: rechazoData,
                backgroundColor: '#ef4444',
              },
            ],
          },
          options: {
            responsive: false,
            indexAxis: 'y' as const,
            barPercentage: 0.8,
            categoryPercentage: 0.85,
            plugins: {
              title: {
                display: true,
                text: titulo,
                font: { size: 16, weight: 'bold' as const },
                padding: 10,
              },
              legend: { position: 'top' as const },
              datalabels: {
                anchor: 'end' as const,
                align: 'end' as const,
                offset: 4,
                formatter: (value: number) => value.toLocaleString('es-CO'),
                font: { size: 9, weight: 'bold' as const },
                color: '#1f2937',
              },
            },
            scales: {
              x: {
                beginAtZero: true,
                max: maxRedondeado,
                grid: { color: '#e5e7eb' },
                ticks: {
                  callback: (value: number) => value.toLocaleString('es-CO'),
                  stepSize: stepSize,
                },
              },
              y: { grid: { display: false } },
            },
          },
        };
      };

      const imageBufferBq = await chartJSNodeCanvas.renderToBuffer(
        crearConfiguracionGrafico(
          'BODEGA BARRANQUILLA - HISTÓRICO',
          bqAprovechamiento,
          bqRechazo,
        ),
      );
      const imageBufferPuerto = await chartJSNodeCanvas.renderToBuffer(
        crearConfiguracionGrafico(
          'BODEGA PUERTO COLOMBIA - HISTÓRICO',
          puertoAprovechamiento,
          puertoRechazo,
        ),
      );

      // --- MAQUETACIÓN VISUAL ---
      doc.rect(0, 0, 150, 842).fill('#10b981');
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(24)
        .text('RECOVEN', 0, 40, { width: 150, align: 'center' });
      doc
        .fontSize(9)
        .font('Helvetica')
        .text('ECA SAS ESP', 0, 68, { width: 150, align: 'center' });

      doc
        .save()
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(28)
        .translate(-15, 750)
        .rotate(-90)
        .text(`TONELADAS APROVECHADAS ${year}`, { characterSpacing: 0 })
        .restore();

      const inicioX = 180;
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('Reporte Ejecutivo de Operaciones', inicioX, 40);
      doc
        .fillColor('#4b5563')
        .font('Helvetica')
        .fontSize(10)
        .text(
          'ANÁLISIS ESTADÍSTICO DE APROVECHAMIENTO Y RECHAZO BODEGAS',
          inicioX,
          64,
        );
      doc
        .moveTo(inicioX, 80)
        .lineTo(550, 80)
        .strokeColor('#10b981')
        .lineWidth(2)
        .stroke();

      const imgWidth = 350;
      const imgHeight = (imgWidth / chartWidth) * chartHeight;

      doc.image(imageBufferBq, inicioX, 100, {
        width: imgWidth,
        height: imgHeight,
      });

      const posicionGrafica2 = 100 + imgHeight + 25;
      doc.image(imageBufferPuerto, inicioX, posicionGrafica2, {
        width: imgWidth,
        height: imgHeight,
      });

      const posicionTotales = Math.max(posicionGrafica2 + imgHeight + 20, 740);
      doc.rect(inicioX, posicionTotales, 350, 45).fill('#f3f4f6');
      doc.rect(inicioX, posicionTotales, 5, 45).fill('#10b981');

      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(
          `TOTAL TONELADAS GESTIONADAS (AÑO ${year}):`,
          inicioX + 15,
          posicionTotales + 8,
        );
      doc
        .fillColor('#10b981')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(
          `${totalGeneral.toLocaleString('es-CO')} t`,
          inicioX + 15,
          posicionTotales + 24,
        );

      doc
        .moveTo(inicioX, posicionTotales + 52)
        .lineTo(550, posicionTotales + 52)
        .strokeColor('#e5e7eb')
        .lineWidth(0.5)
        .stroke();
      doc
        .fillColor('#9ca3af')
        .font('Helvetica')
        .fontSize(7)
        .text(
          'Generado automáticamente por el Sistema RECOVEN Core • Soporte Operativo Interno',
          inicioX,
          posicionTotales + 60,
        );

      if (i < yearsAvailable.length - 1) doc.addPage();
    }

    doc.end();
    return streamToBuffer(doc);
  }
}
