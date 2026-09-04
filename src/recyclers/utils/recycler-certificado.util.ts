import PDFDocument from 'pdfkit';
import type { TipoDocumento } from '@prisma/client';

const COOPERATIVA_NOMBRE = 'RECOVEN ECA SAS ESP';
const COOPERATIVA_NIT = 'NIT 901427170-6';

// Cómo se nombra cada tipo dentro del texto del certificado — en
// minúscula porque va después de "identificado(a) con".
const TIPO_DOCUMENTO_TEXTO: Record<TipoDocumento, string> = {
  CEDULA_CIUDADANIA: 'cédula de ciudadanía',
  CEDULA_EXTRANJERIA: 'cédula extranjera',
  CEDULA_VENEZOLANA: 'cédula venezolana',
  PASAPORTE: 'pasaporte',
  OTRO: 'documento de identidad',
};

export interface DatosCertificado {
  nombreCompleto: string;
  tipoDocumento: TipoDocumento;
  cedula: string;
  barrios: string[];
  fechaVinculacion: Date | string;
}

function formatearFecha(fecha: Date | string): string {
  // Mismo motivo que en recyclers-export.util.ts: fechaVinculacion se
  // guarda como medianoche UTC del día elegido — getUTC*() en vez de
  // get*() evita que se corra un día en cualquier servidor detrás de UTC
  // (Colombia, UTC-5), sin importar en qué máquina corra el proceso.
  const d = new Date(fecha);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
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
  const tipoDocumentoTexto =
    TIPO_DOCUMENTO_TEXTO[datos.tipoDocumento] ?? 'documento de identidad';
  const cuerpoTexto =
    `Por medio del presente documento, RECOVEN ECA SAS ESP certifica que ` +
    `${datos.nombreCompleto}, identificado(a) con ${tipoDocumentoTexto} No. ` +
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

  // --- Barrios asignados ---
  // Se mide la altura real (puede ocupar más de una línea si el
  // reciclador tiene varios barrios) para no encimarse con las firmas de
  // más abajo.
  const barriosTexto =
    datos.barrios.length > 0
      ? datos.barrios.join(', ')
      : 'Sin barrios asignados';

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
  doc.text('Barrios:', x + margenX, cursorY, { width: anchoTexto });
  cursorY += doc.heightOfString('Barrios:', { width: anchoTexto }) + 2;

  doc.font('Helvetica').fontSize(10);
  const alturaBarrios = doc.heightOfString(barriosTexto, { width: anchoTexto });
  doc.text(barriosTexto, x + margenX, cursorY, { width: anchoTexto });
  cursorY += alturaBarrios + 20; // espacio antes de firmas

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

// Dibuja UNA página completa (2 copias + línea de corte punteada) para un
// solo reciclador — extraído de generarCertificadoPdf para poder
// reutilizarlo también en generarCertificadoGeneralPdf (una página por
// cada reciclador del reporte combinado), sin duplicar esta maquetación
// en dos lugares.
function dibujarPaginaCompleta(
  doc: InstanceType<typeof PDFDocument>,
  datos: DatosCertificado,
): void {
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

  const ySegunda = yPrimera + alturaCopia1 + gapEntreCopias;
  dibujarCopia(doc, datos, margenExterno, ySegunda, anchoCopia);

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
}

/**
 * Certificado individual (una hoja, 2 copias) — el que se descarga desde
 * la fila de un solo reciclador en la tabla.
 */
export function generarCertificadoPdf(
  datos: DatosCertificado,
): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
  dibujarPaginaCompleta(doc, datos);
  return doc;
}

// Cede el control al event loop entre cada reciclador — sin esto, generar
// el PDF combinado (trabajo de CPU síncrono en pdfkit: medir y componer
// texto para cada uno) bloquea Node.js de punta a punta, y CUALQUIER OTRA
// petición que llegue mientras tanto (un filtro de la tabla, otro toggle
// de censo) queda atorada detrás, aunque no tenga nada que ver con esto.
function cederControl(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Certificado combinado: una página (2 copias) por cada reciclador de la
 * lista, todo en un solo PDF — el reporte general que se guarda en
 * Storage (ver RecyclersService.regenerarReporteCertificadosGeneral) y
 * que "Exportar certificados" descarga directo desde ahí.
 */
export async function generarCertificadoGeneralPdf(
  listaDatos: DatosCertificado[],
): Promise<InstanceType<typeof PDFDocument>> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 });

  for (let i = 0; i < listaDatos.length; i++) {
    if (i > 0) doc.addPage();
    dibujarPaginaCompleta(doc, listaDatos[i]);
    await cederControl();
  }

  return doc;
}
