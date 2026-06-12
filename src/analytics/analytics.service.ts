import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateMetricDto } from './dto/update-metric.dto';
import PDFDocument from 'pdfkit';
import { DeleteMetricDto } from './dto/delete-metric.dto';
import { createCanvas } from '@napi-rs/canvas';

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

  /**
   * Genera un gráfico de barras horizontal usando @napi-rs/canvas.
   * Es síncrono, no necesita async/await.
   */
  private generarGraficoHorizontal(
    titulo: string,
    labels: string[],
    datasets: { label: string; data: number[]; backgroundColor: string }[],
    maxValueRounded: number,
  ): Buffer {
    // Si no hay datos o maxValueRounded es 0, devolvemos un canvas blanco con mensaje
    if (labels.length === 0 || maxValueRounded === 0) {
      const canvas = createCanvas(500, 200);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 500, 200);
      ctx.font = '14px "Arial", sans-serif';
      ctx.fillStyle = '#999';
      ctx.textAlign = 'center';
      ctx.fillText('No hay datos disponibles', 250, 100);
      return canvas.toBuffer('image/png');
    }

    const width = 500;
    const leftMargin = 100;
    const rightMargin = 50;
    const topMargin = 80;
    const bottomMargin = 40;
    const barHeight = 20;
    const groupSpacing = 10;
    const barSpacing = 4;

    const numCategories = labels.length;
    const totalGroupHeight =
      barHeight * datasets.length + barSpacing * (datasets.length - 1);
    const rowHeight = totalGroupHeight + groupSpacing;
    const canvasHeight = topMargin + bottomMargin + numCategories * rowHeight;

    const canvas = createCanvas(width, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, canvasHeight);

    // Título (fuente segura)
    ctx.font = 'bold 16px "Arial", sans-serif';
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.fillText(titulo, width / 2, 30);

    // Leyenda
    const legendX = width - 150;
    const legendY = 50;
    ctx.font = '12px "Arial", sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < datasets.length; i++) {
      const ds = datasets[i];
      ctx.fillStyle = ds.backgroundColor;
      ctx.fillRect(legendX, legendY + i * 20, 15, 15);
      ctx.fillStyle = '#000';
      ctx.fillText(ds.label, legendX + 20, legendY + i * 20 + 12);
    }

    const maxBarWidth = width - leftMargin - rightMargin - 50;

    // Cuadrícula vertical
    ctx.save();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    const xSteps = 5;
    for (let i = 0; i <= xSteps; i++) {
      const x = leftMargin + (i / xSteps) * maxBarWidth;
      ctx.beginPath();
      ctx.moveTo(x, topMargin - 10);
      ctx.lineTo(x, canvasHeight - bottomMargin + 10);
      ctx.stroke();
    }
    ctx.restore();

    // Dibujar barras y etiquetas de meses
    for (let catIndex = 0; catIndex < numCategories; catIndex++) {
      const label = labels[catIndex];
      const yBase = topMargin + catIndex * rowHeight;

      ctx.font = '12px "Arial", sans-serif';
      ctx.fillStyle = '#374151';
      ctx.textAlign = 'right';
      ctx.fillText(label, leftMargin - 10, yBase + totalGroupHeight / 2 + 6);

      let yOffset = 0;
      for (let dsIndex = 0; dsIndex < datasets.length; dsIndex++) {
        const ds = datasets[dsIndex];
        const value = ds.data[catIndex];
        const barWidth = Math.min(
          (value / maxValueRounded) * maxBarWidth,
          maxBarWidth,
        );
        const y = yBase + yOffset;
        ctx.fillStyle = ds.backgroundColor;
        ctx.fillRect(leftMargin, y, barWidth, barHeight);

        if (value > 0) {
          ctx.font = '9px "Arial", sans-serif';
          ctx.fillStyle = '#1f2937';
          ctx.textAlign = 'left';
          ctx.fillText(
            value.toLocaleString('es-CO'),
            leftMargin + barWidth + 5,
            y + barHeight - 3,
          );
        }
        yOffset += barHeight + barSpacing;
      }
    }

    // Eje X y ticks
    ctx.beginPath();
    ctx.moveTo(leftMargin, canvasHeight - bottomMargin);
    ctx.lineTo(leftMargin + maxBarWidth, canvasHeight - bottomMargin);
    ctx.stroke();
    ctx.font = '10px "Arial", sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    for (let i = 0; i <= xSteps; i++) {
      const value = (maxValueRounded / xSteps) * i;
      const x = leftMargin + (i / xSteps) * maxBarWidth;
      ctx.fillText(
        value.toLocaleString('es-CO'),
        x,
        canvasHeight - bottomMargin + 15,
      );
    }

    const buffer = canvas.toBuffer('image/png');
    // Log para depuración (se verá en Vercel)
    console.log('🎨 Canvas size:', width, canvasHeight);
    console.log('🎨 Buffer size:', buffer.length);
    return buffer;
  }

  async generarReportePDF(): Promise<Buffer> {
    const metrics = await this.prisma.metric.findMany({
      orderBy: [{ year: 'asc' }, { sede: 'asc' }, { mes: 'asc' }],
    });

    // Logs para depuración
    console.log('📊 Metrics count:', metrics.length);
    if (metrics.length > 0) {
      console.log('📊 Sample metric:', metrics[0]);
    } else {
      console.log('📊 No hay métricas en la base de datos');
    }

    if (metrics.length === 0) {
      throw new Error('No hay métricas para generar el reporte');
    }

    const yearsAvailable = [...new Set(metrics.map((m) => m.year))].sort(
      (a, b) => a - b,
    );
    const doc = new PDFDocument({ size: 'A4', margin: 0 });

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

      // Calcular máximo redondeado como antes, evitando división por cero
      const maxValor = Math.max(
        ...bqAprovechamiento,
        ...bqRechazo,
        ...puertoAprovechamiento,
        ...puertoRechazo,
        1,
      );
      const stepSize = 20000;
      const maxRedondeado =
        maxValor === 0
          ? stepSize
          : Math.ceil((maxValor * 1.15) / stepSize) * stepSize;

      // Logs para depuración
      console.log('📊 Barranquilla aprovechamiento:', bqAprovechamiento);
      console.log('📊 Barranquilla rechazo:', bqRechazo);
      console.log('📊 maxRedondeado:', maxRedondeado);

      // Generar buffers de los gráficos (ahora síncronos)
      const imageBufferBq = this.generarGraficoHorizontal(
        'BODEGA BARRANQUILLA - HISTÓRICO',
        meses,
        [
          {
            label: 'Aprovechamiento (t)',
            data: bqAprovechamiento,
            backgroundColor: '#10b981',
          },
          { label: 'Rechazo (t)', data: bqRechazo, backgroundColor: '#ef4444' },
        ],
        maxRedondeado,
      );

      const imageBufferPuerto = this.generarGraficoHorizontal(
        'BODEGA PUERTO COLOMBIA - HISTÓRICO',
        meses,
        [
          {
            label: 'Aprovechamiento (t)',
            data: puertoAprovechamiento,
            backgroundColor: '#10b981',
          },
          {
            label: 'Rechazo (t)',
            data: puertoRechazo,
            backgroundColor: '#ef4444',
          },
        ],
        maxRedondeado,
      );

      // --- MAQUETACIÓN VISUAL (idéntica a la original) ---
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
      // Calcular altura de la imagen en función del número de meses
      const chartHeight = 80 + meses.length * 35;
      const imgHeight = (imgWidth / 500) * chartHeight;

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
