import * as ExcelJS from 'exceljs';

export type TipoExportRecyclers =
  | 'todos'
  | 'desvinculados'
  | 'censados'
  | 'no_censados'
  | 'con_ruta'
  | 'sin_ruta';

const TIPOS_VALIDOS: TipoExportRecyclers[] = [
  'todos',
  'desvinculados',
  'censados',
  'no_censados',
  'con_ruta',
  'sin_ruta',
];

export function parseTipoExportRecyclers(
  tipo: string | undefined,
): TipoExportRecyclers {
  return TIPOS_VALIDOS.includes(tipo as TipoExportRecyclers)
    ? (tipo as TipoExportRecyclers)
    : 'todos';
}

/**
 * Traduce el tipo de exportación a los filtros que ya entiende
 * RecyclersService.findAll — reutiliza exactamente la misma lógica que ya
 * usa la tabla del admin, no se duplica ninguna consulta.
 */
export function mapearTipoAFiltrosFindAll(tipo: TipoExportRecyclers): {
  desvinculados?: boolean;
  rutas?: 'con_ruta' | 'sin_ruta';
  censado?: boolean;
} {
  switch (tipo) {
    case 'desvinculados':
      return { desvinculados: true };
    case 'censados':
      return { censado: true };
    case 'no_censados':
      return { censado: false };
    case 'con_ruta':
      return { rutas: 'con_ruta' };
    case 'sin_ruta':
      return { rutas: 'sin_ruta' };
    case 'todos':
    default:
      return {};
  }
}

// Mismos tonos que usan los estilos de celda predefinidos de Excel
// ("Bueno"/"Malo"/"Neutral") al marcar valores verdadero/falso con formato
// condicional — no son colores inventados.
const COLOR_BUENO = { fill: 'FFC6EFCE', font: 'FF006100' }; // verde suave
const COLOR_MALO = { fill: 'FFFFC7CE', font: 'FF9C0006' }; // rojo suave
const COLOR_NEUTRAL = { fill: 'FFFFEB9C', font: 'FF9C6500' }; // amarillo suave
const COLOR_AZUL = { fill: 'FFDDEBF7', font: 'FF1F4E78' }; // azul suave

function aplicarColor(
  cell: ExcelJS.Cell,
  color: { fill: string; font: string },
): void {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: color.fill },
  };
  cell.font = { color: { argb: color.font } };
}

function formatearFecha(fecha: Date | string): string {
  // fechaIngreso se guarda como medianoche UTC del día que se eligió (una
  // fecha de calendario, no un instante preciso) — getDate()/getMonth()/
  // getFullYear() leen en la zona horaria LOCAL del proceso, así que en
  // cualquier máquina detrás de UTC (Colombia, UTC-5) esa medianoche UTC
  // cae en el día anterior. getUTCDate()/getUTCMonth()/getUTCFullYear()
  // no dependen de en qué zona horaria corra el servidor.
  const d = new Date(fecha);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Mismo criterio que formatearDiasFrecuenciaCorto() en types/microrruta.ts
// del frontend — duplicado a propósito, no importado: frontend y backend
// son dos aplicaciones separadas, no comparten árbol de src/. Convierte
// "1-3-5" en "LU MI VI"; el código 8 (Eventual) se muestra como la
// palabra completa.
const DIA_EVENTUAL = 8;
const DIAS_FRECUENCIA_CORTOS: Record<number, string> = {
  1: 'LU',
  2: 'MA',
  3: 'MI',
  4: 'JU',
  5: 'VI',
  6: 'SA',
  7: 'DO',
};

function formatearDiasFrecuenciaCorto(diasFrecuencia: string | null): string {
  if (!diasFrecuencia) return '—';
  return diasFrecuencia
    .split('-')
    .map((codigo) => {
      const num = Number(codigo);
      if (num === DIA_EVENTUAL) return 'Eventual';
      return DIAS_FRECUENCIA_CORTOS[num] ?? codigo;
    })
    .join(' ');
}

// Forma exacta de lo que devuelve RecyclersService.findAll() (ya mapeado,
// no el resultado crudo de Prisma).
interface RecyclerExportRow {
  id: number;
  cedula: string;
  nombreCompleto: string;
  censado: boolean;
  clasificacion: string;
  detalleUbicacion: string | null;
  deletedAt: Date | string | null;
  barrios: Array<{ barrioId: string; nombreBarrio: string }>;
  microrrutas: Array<{
    id: number;
    nombre: string;
    diasFrecuencia: string | null;
  }>;
  fechaIngreso: Date | string;
  updatedAt: Date | string;
}

/**
 * Genera el Excel de recicladores. `desvinculados` es el único tipo que NO
 * lleva columna de Clasificación (no aplica al histórico) — el resto de
 * columnas y los colores de Censo/Rutas son iguales en todos los tipos.
 */
export async function generarExcelRecyclers(
  recyclers: RecyclerExportRow[],
  tipo: TipoExportRecyclers,
): Promise<Buffer> {
  const incluyeClasificacion = tipo !== 'desvinculados';

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Recicladores');

  const columnas: Partial<ExcelJS.Column>[] = [
    { header: 'N°', key: 'numero', width: 6 },
    { header: 'Nombre Completo', key: 'nombreCompleto', width: 32 },
    { header: 'Cédula', key: 'cedula', width: 16 },
    { header: 'Barrios', key: 'barrios', width: 30 },
  ];
  if (incluyeClasificacion) {
    columnas.push({ header: 'Clasificación', key: 'clasificacion', width: 16 });
  }
  columnas.push(
    { header: 'Censo', key: 'censo', width: 10 },
    { header: 'Rutas', key: 'rutas', width: 30 },
    { header: 'Días de Frecuencia', key: 'diasFrecuencia', width: 20 },
    { header: 'Fecha de Ingreso', key: 'fechaIngreso', width: 16 },
    { header: 'Última Actualización', key: 'updatedAt', width: 18 },
  );
  if (!incluyeClasificacion) {
    // Solo aplica al histórico — para los activos deletedAt siempre es
    // null (el propio findAll los filtra con deletedAt: null).
    columnas.push({
      header: 'Fecha de Eliminación',
      key: 'deletedAt',
      width: 18,
    });
  }

  sheet.columns = columnas;
  sheet.getRow(1).font = { bold: true };

  for (const [index, r] of recyclers.entries()) {
    const tieneRutas = r.microrrutas.length > 0;

    const rowData: Record<string, unknown> = {
      numero: index + 1,
      nombreCompleto: r.nombreCompleto,
      cedula: r.cedula,
      // El detalle se agrega una sola vez, al final de la lista completa
      // de barrios — es un solo campo general por reciclador (no uno por
      // cada barrio), así que no tiene sentido repetirlo por barrio.
      barrios:
        r.barrios.map((b) => b.nombreBarrio || b.barrioId).join(', ') +
        (r.detalleUbicacion ? ` (${r.detalleUbicacion})` : ''),
      censo: r.censado ? 'SI' : 'NO',
      rutas: tieneRutas ? r.microrrutas.map((m) => m.nombre).join(', ') : '',
      // Misma posición que las rutas correspondientes en la columna de al
      // lado, separadas por coma en el mismo orden — así se sabe cuál
      // diasFrecuencia es de cuál ruta cuando hay varias.
      diasFrecuencia: tieneRutas
        ? r.microrrutas
            .map((m) => formatearDiasFrecuenciaCorto(m.diasFrecuencia))
            .join(', ')
        : '',
      fechaIngreso: formatearFecha(r.fechaIngreso),
      updatedAt: formatearFecha(r.updatedAt),
    };
    if (!incluyeClasificacion) {
      rowData.deletedAt = r.deletedAt ? formatearFecha(r.deletedAt) : '';
    }
    if (incluyeClasificacion) {
      rowData.clasificacion = r.clasificacion;
    }

    const row = sheet.addRow(rowData);

    aplicarColor(row.getCell('censo'), r.censado ? COLOR_BUENO : COLOR_MALO);
    aplicarColor(row.getCell('rutas'), tieneRutas ? COLOR_BUENO : COLOR_MALO);

    if (incluyeClasificacion) {
      const colorClasificacion =
        r.clasificacion === 'NUEVO'
          ? COLOR_AZUL
          : r.clasificacion === 'REGULAR'
            ? COLOR_BUENO
            : COLOR_NEUTRAL; // A_QUITAR
      aplicarColor(row.getCell('clasificacion'), colorClasificacion);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
