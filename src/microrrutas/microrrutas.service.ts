import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMicrorrutaDto } from './dto/create-microrruta.dto';
import { Prisma } from '@prisma/client';
import { UpdateMicrorrutaDto } from './dto/update-microrruta.dto';
import * as ExcelJS from 'exceljs';

function formatearFechaDDMMYYYY(fecha: Date | string): string {
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

@Injectable()
export class MicrorrutasService {
  constructor(private prisma: PrismaService) {}

  // Extrae la geometría asegurando tipado estricto sin 'any'
  private extractGeometry(geojson: unknown): unknown {
    if (
      geojson &&
      typeof geojson === 'object' &&
      'geometry' in geojson &&
      geojson.geometry !== null
    ) {
      return (geojson as Record<string, unknown>).geometry;
    }
    return geojson;
  }

  // Consulta con transformación a EPSG:4326 para el mapa
  async findAll(params: { barrioCod?: string; localidadCod?: string }) {
    // Cada fragmento se arma con el tagged template Prisma.sql, que parametriza
    // los valores en vez de concatenarlos como texto — esto es lo que cierra
    // la inyección: params.barrioCod/localidadCod nunca tocan la query como
    // string, viajan como parámetros reales, sin importar qué contengan.
    const joins: Prisma.Sql[] = [];
    const whereConditions: Prisma.Sql[] = [];

    if (params.barrioCod) {
      joins.push(Prisma.sql`CROSS JOIN barrios b`);
      whereConditions.push(
        Prisma.sql`ST_Intersects(m.geom, b.geom) AND b.identificador = ${params.barrioCod}`,
      );
    }

    if (params.localidadCod) {
      joins.push(Prisma.sql`CROSS JOIN localidades l`);
      whereConditions.push(
        Prisma.sql`ST_Intersects(m.geom, l.geom) AND l.identificador = ${params.localidadCod}`,
      );
    }

    const joinClause =
      joins.length > 0 ? Prisma.join(joins, ' ') : Prisma.sql``;
    const whereClause =
      whereConditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`
        : Prisma.sql``;

    // $queryRaw (no Unsafe) — los fragmentos Prisma.sql anidados arriba se
    // combinan de forma segura dentro de este template.
    return this.prisma.$queryRaw`
    SELECT DISTINCT ON (m.id)
      m.id, m.nombre, m.tipo, m.fecha_operacion, m.dir_inicio, m.hora_inicio,
      m.dir_fin, m.hora_fin, m.dist_pavimentada, m.dist_no_pavimentada,
      m.frecuencia, m.dias_frecuencia, m.estacion_transferencia, m.tipo_barrido,
      m.estado,
      ST_AsGeoJSON(ST_Transform(m.geom, 4326))::json AS geojson,
      ROUND((ST_Length(m.geom) / 1000)::numeric, 2) AS longitud_calculada_km
    FROM microrrutas m
    ${joinClause}
    ${whereClause}
    ORDER BY m.id
  `;
  }

  async create(dto: CreateMicrorrutaDto) {
    const geometryObj = this.extractGeometry(dto.geojson);
    const geojsonStr = geometryObj ? JSON.stringify(geometryObj) : null;

    const geomSql = geojsonStr
      ? Prisma.sql`ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(${geojsonStr}), 4326), 9377)`
      : Prisma.sql`NULL`;

    try {
      const result = await this.prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO microrrutas (
        nombre, tipo, fecha_operacion, dir_inicio, hora_inicio, dir_fin, hora_fin,
        dist_pavimentada, dist_no_pavimentada, frecuencia, dias_frecuencia,
        estacion_transferencia, tipo_barrido, estado, geom, created_at, updated_at
      )
      VALUES (
        ${dto.nombre}, 
        ${dto.tipo}, 
        ${dto.fechaOperacion ? new Date(dto.fechaOperacion) : null},
        ${dto.dirInicio ?? null}, 
        ${dto.horaInicio ?? null}, 
        ${dto.dirFin ?? null}, 
        ${dto.horaFin ?? null},
        ${dto.distPavimentada ?? 0}, 
        ${dto.distNoPavimentada ?? 0}, 
        ${dto.frecuencia ?? null},
        ${dto.diasFrecuencia ?? null}, 
        ${dto.estacionTransferencia ?? null}, 
        ${dto.tipoBarrido ?? null},
        'BORRADOR'::"EstadoMicrorruta",
        ${geomSql},
        NOW(),
        NOW()
      )
      RETURNING id;
    `;

      return result[0];
    } catch (error) {
      console.error('Error detallado:', error);
      throw new BadRequestException(
        'Formato de GeoJSON inválido o error en la inserción',
      );
    }
  }

  async updateGeom(id: number, geojson: object) {
    const geometryObj = this.extractGeometry(geojson);
    const geojsonStr = JSON.stringify(geometryObj);

    await this.prisma.$executeRaw`
      UPDATE microrrutas 
      SET geom = ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(${geojsonStr}), 4326), 9377),
          updated_at = NOW()
      WHERE id = ${id};
    `;

    return { success: true };
  }

  async delete(id: number) {
    return this.prisma.microrruta.delete({ where: { id } });
  }

  async update(id: number, dto: UpdateMicrorrutaDto) {
    const { geojson, fechaOperacion, ...data } = dto;

    // Si el formulario incluye cambios en la geometría, actualizamos la columna PostGIS (EPSG:9377)
    if (geojson) {
      await this.updateGeom(id, geojson);
    }

    // Actualizamos el resto de atributos del SUI en Prisma
    return this.prisma.microrruta.update({
      where: { id },
      data: {
        ...data,
        ...(fechaOperacion && { fechaOperacion: new Date(fechaOperacion) }),
      },
    });
  }

  async exportarExcel(params: {
    barrioCod?: string;
    localidadCod?: string;
  }): Promise<Buffer> {
    // Reutiliza la misma consulta de findAll (mismo filtro, mismo orden) para
    // que el Excel siempre coincida con lo que se ve en la tabla del admin.
    const rutas = (await this.findAll(params)) as Array<{
      nombre: string;
      tipo: number;
      fecha_operacion: Date | string | null;
      dir_inicio: string | null;
      hora_inicio: string | null;
      dir_fin: string | null;
      hora_fin: string | null;
      dist_pavimentada: number | null;
      dist_no_pavimentada: number | null;
      frecuencia: number | null;
      dias_frecuencia: string | null;
      estacion_transferencia: number | null;
      tipo_barrido: number | null;
    }>;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Microrrutas');

    // Encabezados: números puros (1 a 13), tal como exige el formato del
    // reporte de microrrutas del SUI — no son nombres de columna descriptivos.
    sheet.columns = [
      { header: '1', key: 'c1', width: 16 },
      { header: '2', key: 'c2', width: 6 },
      { header: '3', key: 'c3', width: 12 },
      { header: '4', key: 'c4', width: 28 },
      { header: '5', key: 'c5', width: 10 },
      { header: '6', key: 'c6', width: 28 },
      { header: '7', key: 'c7', width: 10 },
      { header: '8', key: 'c8', width: 10 },
      { header: '9', key: 'c9', width: 10 },
      { header: '10', key: 'c10', width: 10 },
      { header: '11', key: 'c11', width: 10 },
      { header: '12', key: 'c12', width: 10 },
      { header: '13', key: 'c13', width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const r of rutas) {
      sheet.addRow({
        c1: r.nombre,
        c2: r.tipo,
        c3: r.fecha_operacion ? formatearFechaDDMMYYYY(r.fecha_operacion) : '',
        c4: r.dir_inicio ?? '',
        c5: r.hora_inicio ?? '',
        c6: r.dir_fin ?? '',
        c7: r.hora_fin ?? '',
        c8: r.dist_pavimentada ?? 0,
        c9: r.dist_no_pavimentada ?? 0,
        c10: r.frecuencia ?? '',
        c11: r.dias_frecuencia ?? '',
        c12: r.estacion_transferencia ?? '',
        c13: r.tipo_barrido ?? '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
