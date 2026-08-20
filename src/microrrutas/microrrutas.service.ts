import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMicrorrutaDto } from './dto/create-microrruta.dto';
import { Prisma } from '@prisma/client';

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
    const joins: string[] = [];
    const whereConditions: string[] = [];

    if (params.barrioCod) {
      joins.push('CROSS JOIN barrios b');
      whereConditions.push(
        `ST_Intersects(m.geom, b.geom) AND b.identificador = '${params.barrioCod}'`,
      );
    }

    if (params.localidadCod) {
      joins.push('CROSS JOIN localidades l');
      whereConditions.push(
        `ST_Intersects(m.geom, l.geom) AND l.identificador = '${params.localidadCod}'`,
      );
    }

    const joinClause = joins.join(' ');
    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const query = `
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

    return this.prisma.$queryRawUnsafe(query);
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
}
