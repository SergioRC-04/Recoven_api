// src/analytics/utils/metrics-report.util.ts
//
// Composición del reporte ejecutivo PDF de métricas (gráficas + maquetación).
// No accede a la base de datos: recibe las métricas ya consultadas, para
// mantenerse como una función pura, reutilizable y fácil de probar aparte
// del resto de analytics.service.ts.

import PDFDocument from 'pdfkit';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import type { Metric } from '@prisma/client';
import { streamToBuffer } from '../../common/utils/stream-to-buffer.util';

/**
 * Genera un gráfico de barras horizontal adaptativo.
 * Retorna el buffer de la imagen y la altura final del lienzo.
 */
function generarGraficoHorizontal(
  titulo: string,
  labels: string[],
  datasets: { label: string; data: number[]; backgroundColor: string }[],
  maxValueRounded: number,
): { buffer: Buffer; height: number } {
  // Registrar la fuente Open Sans
  try {
    const fontPath = path.join(process.cwd(), 'fonts', 'OpenSans-Regular.ttf');
    GlobalFonts.registerFromPath(fontPath, 'Open Sans');
  } catch (error) {
    console.error('Error al registrar la fuente Open Sans:', error);
  }

  const width = 800;

  // Caso sin datos
  if (labels.length === 0 || maxValueRounded === 0) {
    const canvas = createCanvas(width, 300);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, 300);
    ctx.font = '20px "Open Sans", sans-serif';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText('No hay datos disponibles', width / 2, 150);
    return { buffer: canvas.toBuffer('image/png'), height: 300 };
  }

  // Ajuste dinámico de dimensiones según la cantidad de meses para evitar desbordar el folio
  const numCategories = labels.length;
  let barHeight = 24;
  let barSpacing = 4;
  let groupSpacing = 14;

  if (numCategories > 6) {
    barHeight = 16;
    barSpacing = 3;
    groupSpacing = 8;
  }
  if (numCategories > 9) {
    barHeight = 12;
    barSpacing = 2;
    groupSpacing = 6;
  }

  const leftMargin = 120;
  const rightMargin = 120; // Margen derecho amplio para que las etiquetas de valor no se corten
  const topMargin = 95; // Espacio vertical para separar título y leyenda
  const bottomMargin = 45;

  const totalGroupHeight =
    barHeight * datasets.length + barSpacing * (datasets.length - 1);
  const rowHeight = totalGroupHeight + groupSpacing;
  const canvasHeight = topMargin + bottomMargin + numCategories * rowHeight;

  const canvas = createCanvas(width, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Fondo blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, canvasHeight);

  // Título principal (alineado a la izquierda)
  ctx.font = 'bold 20px "Open Sans", sans-serif';
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'left';
  ctx.fillText(titulo, leftMargin, 34);

  // Leyenda horizontal ubicada debajo del título (evita colisiones de texto)
  ctx.font = '12px "Open Sans", sans-serif';
  ctx.textAlign = 'left';

  let legendX = leftMargin;
  const legendY = 58; // Posición vertical debajo del título

  // Primer dataset de la leyenda (Aprovechamiento)
  ctx.fillStyle = datasets[0].backgroundColor;
  ctx.fillRect(legendX, legendY, 12, 12);
  ctx.fillStyle = '#4b5563';
  ctx.fillText(datasets[0].label, legendX + 18, legendY + 10);

  // Segundo dataset de la leyenda (Rechazo)
  legendX += 160; // Espaciado horizontal entre elementos de la leyenda
  ctx.fillStyle = datasets[1].backgroundColor;
  ctx.fillRect(legendX, legendY, 12, 12);
  ctx.fillStyle = '#4b5563';
  ctx.fillText(datasets[1].label, legendX + 18, legendY + 10);

  // Espacio de dibujo de barras
  const maxBarWidth = width - leftMargin - rightMargin;

  // Cuadrícula vertical de fondo
  ctx.save();
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineWidth = 1;
  const xSteps = 5;
  for (let i = 0; i <= xSteps; i++) {
    const x = leftMargin + (i / xSteps) * maxBarWidth;
    ctx.beginPath();
    ctx.moveTo(x, topMargin - 10);
    ctx.lineTo(x, canvasHeight - bottomMargin + 10);
    ctx.stroke();
  }
  ctx.restore();

  // Dibujo de barras y textos
  for (let catIndex = 0; catIndex < numCategories; catIndex++) {
    const label = labels[catIndex];
    const yBase = topMargin + catIndex * rowHeight;

    // Etiqueta de la categoría (Mes)
    ctx.font = `${numCategories > 8 ? '12px' : '13px'} "Open Sans", sans-serif`;
    ctx.fillStyle = '#4b5563';
    ctx.textAlign = 'right';
    ctx.fillText(label, leftMargin - 12, yBase + totalGroupHeight / 2 + 4);

    let yOffset = 0;
    for (let dsIndex = 0; dsIndex < datasets.length; dsIndex++) {
      const ds = datasets[dsIndex];
      const value = ds.data[catIndex] || 0;
      const barWidth = Math.min(
        (value / maxValueRounded) * maxBarWidth,
        maxBarWidth,
      );
      const y = yBase + yOffset;

      ctx.fillStyle = ds.backgroundColor;
      ctx.fillRect(leftMargin, y, barWidth, barHeight);

      // Valor numérico a la derecha de la barra
      if (value > 0) {
        ctx.font = `${numCategories > 8 ? '12px' : '13px'} "Open Sans", sans-serif`;
        ctx.fillStyle = '#1f2937';
        ctx.textAlign = 'left';
        ctx.fillText(
          value.toLocaleString('es-CO'),
          leftMargin + barWidth + 6,
          y + barHeight - 4,
        );
      }
      yOffset += barHeight + barSpacing;
    }
  }

  // Eje X inferior
  ctx.beginPath();
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1.5;
  ctx.moveTo(leftMargin, canvasHeight - bottomMargin);
  ctx.lineTo(leftMargin + maxBarWidth, canvasHeight - bottomMargin);
  ctx.stroke();

  // Números de escala del Eje X
  ctx.font = '12px "Open Sans", sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'center';
  for (let i = 0; i <= xSteps; i++) {
    const value = (maxValueRounded / xSteps) * i;
    const x = leftMargin + (i / xSteps) * maxBarWidth;
    ctx.fillText(
      value.toLocaleString('es-CO'),
      x,
      canvasHeight - bottomMargin + 18,
    );
  }

  return {
    buffer: canvas.toBuffer('image/png'),
    height: canvasHeight,
  };
}

/**
 * Compone el PDF ejecutivo completo (una página por año) a partir de las
 * métricas ya consultadas. Lanza un Error si `metrics` viene vacío — quien
 * llame a esta función decide qué hacer con ese caso (analytics.service.ts
 * lo deja fallar dentro del intento de regeneración en segundo plano, sin
 * tumbar la operación de guardar/borrar la métrica).
 */
export async function generarReportePDF(metrics: Metric[]): Promise<Buffer> {
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
    const datosPuerto = metricsYear.filter((m) => m.sede === 'PUERTO COLOMBIA');

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

    // Generación de los buffers de los gráficos con sus alturas relativas
    const chartBq = generarGraficoHorizontal(
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

    const chartPuerto = generarGraficoHorizontal(
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

    // --- MAQUETACIÓN VISUAL ---
    // Barra lateral izquierda
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

    // Texto vertical
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

    // Ajuste de ancho a 370 puntos para evitar el desborde horizontal (180 + 370 = 550)
    const imgWidth = 370;

    // Escalado de la altura manteniendo el aspecto original de cada canvas
    const bqImageHeight = (imgWidth / 800) * chartBq.height;
    doc.image(chartBq.buffer, inicioX, 100, {
      width: imgWidth,
      height: bqImageHeight,
    });

    const posicionGrafica2 = 100 + bqImageHeight + 25;
    const puertoImageHeight = (imgWidth / 800) * chartPuerto.height;
    doc.image(chartPuerto.buffer, inicioX, posicionGrafica2, {
      width: imgWidth,
      height: puertoImageHeight,
    });

    // El cuadro de totales se ubica dinámicamente o se fija al final del espacio utilizable
    const posicionTotales = Math.max(
      posicionGrafica2 + puertoImageHeight + 20,
      740,
    );
    doc.rect(inicioX, posicionTotales, 370, 45).fill('#f3f4f6');
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
