import PDFDocument from 'pdfkit';

const COOPERATIVA_NOMBRE = 'RECOVEN ECA SAS ESP';
const COOPERATIVA_NIT = 'NIT 901427170-6';

const CLASIFICACION_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo',
  REGULAR: 'Regular',
  A_QUITAR: 'A quitar',
};

export interface DatosCertificado {
  nombreCompleto: string;
  cedula: string;
  clasificacion: string;
  censado: boolean;
  fechaVinculacion: Date | string;
}

function formatearFecha(fecha: Date | string): string {
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function dibujarCopia(
  doc: InstanceType<typeof PDFDocument>,
  datos: DatosCertificado,
  x: number,
  y: number,
  width: number,
): number {
  const margenX = 28;
  const margenY = 24;
  let cursorY = y + margenY;

  // --- Título cooperativa ---
  doc
    .fillColor('#1e5a3c')
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(COOPERATIVA_NOMBRE, x, cursorY, { width, align: 'center' });
  cursorY += 28;

  // --- Subtítulo ---
  doc
    .fillColor('#000000')
    .font('Helvetica-Bold')
    .fontSize(13)
    .text('CERTIFICADO DE VINCULACIÓN', x, cursorY, { width, align: 'center' });
  cursorY += 24;

  // --- Cuerpo del certificado ---
  const cuerpoTexto =
    `Por medio del presente documento, RECOVEN ECA SAS ESP certifica que ` +
    `${datos.nombreCompleto}, identificado(a) con cédula de ciudadanía No. ` +
    `${datos.cedula}, se encuentra registrado(a) como reciclador(a) de ` +
    `oficio vinculado(a) a esta organización desde el ${formatearFecha(datos.fechaVinculacion)}.`;

  doc.font('Helvetica').fontSize(10).fillColor('#000000');
  const anchoTexto = width - margenX * 2;
  const alturaCuerpo = doc.heightOfString(cuerpoTexto, {
    width: anchoTexto,
    align: 'justify',
  });

  doc.text(cuerpoTexto, x + margenX, cursorY, {
    width: anchoTexto,
    align: 'justify',
  });
  cursorY += alturaCuerpo + 18;

  // --- Clasificación y estado en una línea ---
  const clasificacionTexto =
    CLASIFICACION_LABELS[datos.clasificacion] ?? datos.clasificacion;
  const estadoTexto = datos.censado ? 'Censado' : 'Sin censar';

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('Clasificación:', x + margenX, cursorY, { continued: true });
  doc.font('Helvetica').text(` ${clasificacionTexto}`, { continued: true });
  doc.font('Helvetica-Bold').text('   Estado de censo:', { continued: true });
  doc.font('Helvetica').text(` ${estadoTexto}`);
  cursorY += 40; // más espacio antes de firmas

  // --- Firmas (empresa y trabajador) lado a lado ---
  const separacionColumnas = 50; // más separación entre firmas
  const anchoFirma = (width - margenX * 2 - separacionColumnas) / 2;
  const xFirma1 = x + margenX;
  const xFirma2 = x + margenX + anchoFirma + separacionColumnas;

  const firmaBlockHeight = 48; // un poco más alto

  // Línea firma 1 (empresa)
  doc
    .moveTo(xFirma1, cursorY + 18)
    .lineTo(xFirma1 + anchoFirma, cursorY + 18)
    .strokeColor('#000000')
    .lineWidth(1.5)
    .stroke();

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#000000')
    .text('Firma Empresa', xFirma1, cursorY + 20, {
      width: anchoFirma,
      align: 'center',
    });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#555555')
    .text('Nombre y cargo', xFirma1, cursorY + 34, {
      width: anchoFirma,
      align: 'center',
    });

  // Línea firma 2 (trabajador)
  doc
    .moveTo(xFirma2, cursorY + 18)
    .lineTo(xFirma2 + anchoFirma, cursorY + 18)
    .strokeColor('#000000')
    .lineWidth(1.5)
    .stroke();

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#000000')
    .text('Firma Trabajador', xFirma2, cursorY + 20, {
      width: anchoFirma,
      align: 'center',
    });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#555555')
    .text('Nombre y cédula', xFirma2, cursorY + 34, {
      width: anchoFirma,
      align: 'center',
    });

  cursorY += firmaBlockHeight + 24; // más espacio después de firmas

  // --- Pie de página ---
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#555555')
    .text(
      `${COOPERATIVA_NIT}  —  Documento generado el ${formatearFecha(new Date())}`,
      x,
      cursorY,
      { width, align: 'center' },
    );
  cursorY += 20;

  const alturaContenido = cursorY - y;

  doc
    .save()
    .rect(x, y, width, alturaContenido)
    .lineWidth(1.5)
    .strokeColor('#1e5a3c')
    .stroke()
    .restore();

  return alturaContenido;
}

export function generarCertificadoPdf(
  datos: DatosCertificado,
): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
  const pageWidth = doc.page.width;
  const margenExterno = 24;
  const gapEntreCopias = 24;

  const anchoCopia = pageWidth - margenExterno * 2;

  const yPrimera = 40;
  const alturaCopia1 = dibujarCopia(
    doc,
    datos,
    margenExterno,
    yPrimera,
    anchoCopia,
  );

  const yLineaCorte = yPrimera + alturaCopia1 + gapEntreCopias / 2;
  doc
    .save()
    .dash(6, { space: 4 })
    .moveTo(margenExterno, yLineaCorte)
    .lineTo(pageWidth - margenExterno, yLineaCorte)
    .strokeColor('#999999')
    .lineWidth(1)
    .stroke()
    .undash()
    .restore();

  return doc;
}
