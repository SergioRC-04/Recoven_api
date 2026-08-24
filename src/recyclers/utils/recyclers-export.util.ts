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
 * RecyclersService.findAll — reutiliza exactamente la misma lógica de tabs
 * que ya tienes, no se duplica ninguna consulta.
 */
export function mapearTipoAFiltrosFindAll(tipo: TipoExportRecyclers): {
  tab?: 'con_ruta' | 'sin_ruta' | 'nuevos' | 'a_quitar' | 'desvinculados';
  censado?: boolean;
} {
  switch (tipo) {
    case 'desvinculados':
      return { tab: 'desvinculados' };
    case 'censados':
      return { censado: true };
    case 'no_censados':
      return { censado: false };
    case 'con_ruta':
      return { tab: 'con_ruta' };
    case 'sin_ruta':
      return { tab: 'sin_ruta' };
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
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Forma exacta de lo que devuelve RecyclersService.findAll() (ya mapeado,
// no el resultado crudo de Prisma).
interface RecyclerExportRow {
  id: number;
  cedula: string;
  nombreCompleto: string;
  censado: boolean;
  clasificacion: string;
  deletedAt: Date | string | null;
  barrios: Array<{ barrioId: string; nombreBarrio: string }>;
  microrrutas: Array<{
    id: number;
    nombre: string;
    diasFrecuencia: string | null;
  }>;
  createdAt: Date | string;
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
    { header: 'ID', key: 'id', width: 8 },
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
    { header: 'Fecha de Registro', key: 'createdAt', width: 16 },
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

  for (const r of recyclers) {
    const tieneRutas = r.microrrutas.length > 0;

    const rowData: Record<string, unknown> = {
      id: r.id,
      nombreCompleto: r.nombreCompleto,
      cedula: r.cedula,
      barrios: r.barrios.map((b) => b.nombreBarrio || b.barrioId).join(', '),
      censo: r.censado ? 'SI' : 'NO',
      rutas: tieneRutas ? r.microrrutas.map((m) => m.nombre).join(', ') : '',
      // Misma posición que las rutas correspondientes en la columna de al
      // lado, separadas por coma en el mismo orden — así se sabe cuál
      // diasFrecuencia es de cuál ruta cuando hay varias.
      diasFrecuencia: tieneRutas
        ? r.microrrutas
            .map((m) =>
              m.diasFrecuencia != null ? `${m.diasFrecuencia}` : '—',
            )
            .join(', ')
        : '',
      createdAt: formatearFecha(r.createdAt),
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
