import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMicrorrutaDto } from './dto/create-microrruta.dto';
import { Prisma } from '@prisma/client';
import { UpdateMicrorrutaDto } from './dto/update-microrruta.dto';
import * as ExcelJS from 'exceljs';
import { GeoJsonFeatureCollection } from 'src/geo-territorio/dto/geo-territorio.dto';
import { calcularYGuardarBarriosMicrorruta } from './utils/microrrutas-barrios.util';

function formatearFechaDDMMYYYY(fecha: Date | string): string {
  // fecha_operacion se guarda como medianoche UTC del día elegido —
  // getUTC*() en vez de get*() evita que se corra un día en cualquier
  // servidor detrás de UTC (Colombia, UTC-5), sin importar en qué
  // máquina corra el proceso.
  const d = new Date(fecha);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
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

  // Construye el WHERE de filtro espacial (barrio, localidad y/o
  // macrorruta), compartido entre findAll (mapa/tabla, geometría en
  // 4326) y exportarCapaGeoJson (GIS, geometría nativa en 9377) — así el
  // filtro se mantiene idéntico en los dos casos sin duplicar la lógica.
  //
  // barrioCod y localidadCod se apoyan en microrruta_barrio (ya calculado
  // y guardado al crear/redibujar cada ruta — ver
  // microrrutas-barrios.util.ts), no en un ST_Intersects propio contra el
  // polígono del barrio o de la localidad. Antes, el filtro de localidad
  // SÍ hacía su propio ST_Intersects(m.geom, l.geom) — pero eso asume que
  // el polígono de cada barrio calza perfectamente dentro del polígono de
  // su localidad, y eso no es siempre cierto (un barrio agregado a mano
  // — como "Pinar del Río" — puede pertenecer administrativamente a una
  // localidad, vía localidad_cod, sin que su geometría real llegue a
  // tocar el polígono oficial de esa localidad). Ahora "pertenece a la
  // localidad X" se define como "pertenece a algún barrio cuyo
  // localidad_cod es X" — la misma fuente que ya alimenta la columna
  // "Barrio" de la tabla, así que filtro y columna nunca vuelven a poder
  // contradecirse entre sí.
  //
  // macrorrutaNumero es un filtro distinto: no depende de qué barrios
  // toca la ruta, sino de a qué macrorruta quedó asignada
  // (m.macrorruta_id, calculado también en microrrutas-barrios.util.ts a
  // partir de en qué localidad cae la mayor parte de su trazo) — una
  // ruta puede tocar barrios de dos localidades y aun así pertenecer a
  // una sola macrorruta.
  //
  // Cada fragmento se arma con el tagged template Prisma.sql, que
  // parametriza los valores en vez de concatenarlos como texto — esto es
  // lo que cierra la inyección: los parámetros nunca tocan la query como
  // string, viajan como parámetros reales.
  private construirFiltroEspacial(params: {
    barrioCod?: string;
    localidadCod?: string;
    macrorrutaNumero?: string;
  }): { joinClause: Prisma.Sql; whereClause: Prisma.Sql } {
    const whereConditions: Prisma.Sql[] = [];

    if (params.barrioCod) {
      whereConditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM microrruta_barrio mb
          WHERE mb.microrruta_id = m.id AND mb.barrio_id = ${params.barrioCod}
        )`,
      );
    }

    if (params.localidadCod) {
      whereConditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM microrruta_barrio mb
          JOIN barrios b2 ON b2.identificador = mb.barrio_id
          WHERE mb.microrruta_id = m.id AND b2.localidad_cod = ${params.localidadCod}
        )`,
      );
    }

    if (params.macrorrutaNumero) {
      whereConditions.push(
        Prisma.sql`m.macrorruta_id = (
          SELECT id FROM macrorrutas WHERE numero = ${params.macrorrutaNumero}
        )`,
      );
    }

    return {
      // Ya no hace falta ningún CROSS JOIN — las condiciones son
      // subconsultas autocontenidas. Se conserva joinClause en el valor
      // de retorno (siempre vacío ahora) para no tener que tocar los dos
      // SELECT que la interpolan más abajo.
      joinClause: Prisma.sql``,
      whereClause:
        whereConditions.length > 0
          ? Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`
          : Prisma.sql``,
    };
  }

  // Consulta con transformación a EPSG:4326 para el mapa. El array
  // `barrios` de cada microrruta viene de MicrorrutaBarrio (ya calculado y
  // guardado al crear/redibujar la ruta — ver microrrutas-barrios.util.ts),
  // agregado con una LATERAL join independiente del filtro espacial de
  // arriba (ese filtro decide QUÉ microrrutas aparecen según el
  // barrio/localidad/macrorruta consultados; esta agregación solo arma el
  // array de barrios propios de cada una, sin importar el filtro).
  //
  // macrorruta_numero y localidad_dominante_nombre vienen de un LEFT JOIN
  // contra macrorrutas (por la FK directa m.macrorruta_id) y de ahí a
  // localidades — LEFT, no INNER, porque una microrruta sin barrios
  // asignados (o recién creada, antes de que corra el cálculo) puede no
  // tener todavía macrorruta.
  async findAll(params: {
    barrioCod?: string;
    localidadCod?: string;
    macrorrutaNumero?: string;
  }) {
    const { joinClause, whereClause } = this.construirFiltroEspacial(params);

    return this.prisma.$queryRaw`
    SELECT DISTINCT ON (m.id)
      m.id, m.nombre, m.tipo, m.fecha_operacion, m.dir_inicio, m.hora_inicio,
      m.dir_fin, m.hora_fin, m.dist_pavimentada, m.dist_no_pavimentada,
      m.frecuencia, m.dias_frecuencia, m.estacion_transferencia, m.tipo_barrido,
      m.estado,
      mac.numero AS macrorruta_numero,
      ld.nombre AS localidad_dominante_nombre,
      ST_AsGeoJSON(ST_Transform(m.geom, 4326))::json AS geojson,
      ROUND((ST_Length(m.geom) / 1000)::numeric, 2) AS longitud_calculada_km,
      COALESCE(mb_agg.barrios, '[]'::json) AS barrios
    FROM microrrutas m
    ${joinClause}
    LEFT JOIN macrorrutas mac ON mac.id = m.macrorruta_id
    LEFT JOIN localidades ld ON ld.identificador = mac.localidad_cod
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'barrioCod', b2.identificador,
          'barrioNombre', b2.nombre_barrio,
          'localidadCod', b2.localidad_cod,
          'localidadNombre', l2.nombre
        )
        ORDER BY b2.nombre_barrio
      ) AS barrios
      FROM microrruta_barrio mb2
      JOIN barrios b2 ON b2.identificador = mb2.barrio_id
      LEFT JOIN localidades l2 ON l2.identificador = b2.localidad_cod
      WHERE mb2.microrruta_id = m.id
    ) mb_agg ON true
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

      const nuevaId = result[0].id;
      if (geojsonStr) {
        await calcularYGuardarBarriosMicrorruta(this.prisma, nuevaId);
      }

      return result[0];
    } catch (error) {
      console.error('Error detallado:', error);
      throw new BadRequestException(
        'Formato de GeoJSON inválido o error en la inserción',
      );
    }
  }

  // Actualiza únicamente la geometría — usada tanto por el endpoint
  // dedicado (PUT /microrrutas/:id/geometria) como internamente por
  // update() cuando el payload trae un geojson nuevo. El recálculo de
  // barrios (y, encadenado a partir de ellos, de la localidad dominante y
  // la macrorruta — ver microrrutas-barrios.util.ts) vive aquí, no en
  // cada llamador por separado, para que sea imposible cambiar el trazo
  // sin que ambos se recalculen.
  //
  // dist_pavimentada (campo 8 del reporte SUI) también se recalcula aquí,
  // a partir de la longitud real del trazo NUEVO — antes se quedaba fija
  // en el valor calculado la última vez que se guardó (al crear la ruta, o
  // al editar los datos completos desde el formulario), así que redibujar
  // SOLO el trazo desde el mapa dejaba ese campo con la longitud del trazo
  // VIEJO. dist_no_pavimentada NO se toca — se resta del nuevo total tal
  // cual está guardada, mismo criterio que ya usa el formulario al crear
  // una ruta (total del trazo dibujado menos no pavimentada).
  //
  // Los tipos 3 (limpieza de playas), 4 (corte de césped) y 5 (poda de
  // árboles) siempre van en 0 por regla del SUI — misma lista que ya usa
  // el frontend (TIPOS_SIN_DISTANCIAS_VIALES en types/microrruta.ts) — así
  // que se respeta aquí también, para no terminar escribiendo una
  // distancia real donde el reporte exige 0.
  async updateGeom(id: number, geojson: object) {
    const geometryObj = this.extractGeometry(geojson);
    const geojsonStr = JSON.stringify(geometryObj);

    await this.prisma.$executeRaw`
      UPDATE microrrutas 
      SET geom = ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(${geojsonStr}), 4326), 9377),
          updated_at = NOW()
      WHERE id = ${id};
    `;

    const microrruta = await this.prisma.microrruta.findUnique({
      where: { id },
      select: { tipo: true },
    });
    const TIPOS_SIN_DISTANCIAS_VIALES = [3, 4, 5];
    const requiereDistancia =
      !microrruta || !TIPOS_SIN_DISTANCIAS_VIALES.includes(microrruta.tipo);

    if (requiereDistancia) {
      // dist_no_pavimentada NO se toca — se conserva el valor ya cargado.
      // dist_pavimentada se recalcula como el nuevo total del trazo menos
      // esa distancia sin pavimentar (mismo criterio que se usa al crear
      // la ruta), con GREATEST(...,0) por si la ruta quedó más corta que
      // el valor de no pavimentada ya guardado, para no terminar con un
      // número negativo.
      await this.prisma.$executeRaw`
        UPDATE microrrutas
        SET dist_pavimentada = GREATEST(
              ROUND((ST_Length(geom) / 1000)::numeric, 2) - COALESCE(dist_no_pavimentada, 0),
              0
            )
        WHERE id = ${id};
      `;
    } else {
      await this.prisma.$executeRaw`
        UPDATE microrrutas
        SET dist_pavimentada = 0,
            dist_no_pavimentada = 0
        WHERE id = ${id};
      `;
    }

    await calcularYGuardarBarriosMicrorruta(this.prisma, id);

    return { success: true };
  }

  async delete(id: number) {
    return this.prisma.microrruta.delete({ where: { id } });
  }

  async update(id: number, dto: UpdateMicrorrutaDto) {
    const { geojson, fechaOperacion, ...data } = dto;

    // Si el formulario incluye cambios en la geometría, actualizamos la
    // columna PostGIS (EPSG:9377) — updateGeom ya se encarga de recalcular
    // los barrios como parte de este mismo paso.
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

  // Lista de macrorrutas para el filtro del admin — solo las que de
  // verdad tienen al menos una microrruta cayendo mayoritariamente en su
  // localidad ahora mismo (HAVING COUNT > 0). Una macrorruta ya creada en
  // el pasado, cuya localidad se quedó sin ninguna microrruta, sigue
  // existiendo en la tabla (nunca se borra, ver
  // microrrutas-barrios.util.ts) pero deja de aparecer aquí — así "si en
  // una localidad no hay microrrutas no va a haber macrorruta tampoco" se
  // cumple sin necesidad de un borrado activo.
  async obtenerMacrorrutas() {
    return this.prisma.$queryRaw<
      Array<{
        numero: string;
        localidad_cod: string;
        localidad_nombre: string;
        total: number;
      }>
    >`
      SELECT mac.numero, mac.localidad_cod, l.nombre AS localidad_nombre,
             COUNT(m.id)::int AS total
      FROM macrorrutas mac
      JOIN localidades l ON l.identificador = mac.localidad_cod
      LEFT JOIN microrrutas m ON m.macrorruta_id = mac.id
      GROUP BY mac.numero, mac.localidad_cod, l.nombre
      HAVING COUNT(m.id) > 0
      ORDER BY l.nombre;
    `;
  }

  // GeoJSON de las localidades con macrorruta activa (mismo criterio que
  // obtenerMacrorrutas: al menos una microrruta cayendo mayoritariamente
  // ahí) — para el mapa de macrorrutas. Reutiliza la geometría de
  // Localidades tal cual (reproyectada a 4326), no se guarda ninguna
  // geometría propia por macrorruta.
  async obtenerMacrorrutasGeoJson() {
    const rows = await this.prisma.$queryRaw<Array<{ geojson: string }>>`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'properties', json_build_object(
            'identificador', sub.identificador,
            'nombre', sub.nombre,
            'macrorrutaNumero', sub.numero
          ),
          'geometry', ST_AsGeoJSON(ST_Transform(sub.geom, 4326))::json
        )
      ), '[]'::json)
    )::text AS geojson
    FROM (
      SELECT l.identificador, l.nombre, mac.numero, l.geom
      FROM macrorrutas mac
      JOIN localidades l ON l.identificador = mac.localidad_cod
      WHERE EXISTS (
        SELECT 1 FROM microrrutas m WHERE m.macrorruta_id = mac.id
      )
    ) sub;
  `;

    return JSON.parse(rows[0].geojson) as GeoJsonFeatureCollection;
  }

  async exportarExcel(params: {
    barrioCod?: string;
    localidadCod?: string;
    macrorrutaNumero?: string;
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
    // reporte de microrrutas del SUI — no son nombres de columna descriptivas.
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

  // Igual que findAll en cuanto a filtros (misma construirFiltroEspacial),
  // pero para exportar a QGIS/ArcGIS: geometría nativa en EPSG:9377 (sin
  // ST_Transform), sin el cálculo de longitud (no aplica a un archivo GIS), y
  // con los 13 campos del reporte SUI completos como atributos.
  async exportarCapaGeoJson(params: {
    barrioCod?: string;
    localidadCod?: string;
    macrorrutaNumero?: string;
  }) {
    const { joinClause, whereClause } = this.construirFiltroEspacial(params);

    const rows = await this.prisma.$queryRaw<Array<{ geojson: string }>>`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'id', sub.id,
          'properties', json_build_object(
            'id', sub.id,
            'nombre', sub.nombre,
            'tipo', sub.tipo,
            'fechaOperacion', sub.fecha_operacion,
            'dirInicio', sub.dir_inicio,
            'horaInicio', sub.hora_inicio,
            'dirFin', sub.dir_fin,
            'horaFin', sub.hora_fin,
            'distPavimentada', sub.dist_pavimentada,
            'distNoPavimentada', sub.dist_no_pavimentada,
            'frecuencia', sub.frecuencia,
            'diasFrecuencia', sub.dias_frecuencia,
            'estacionTransferencia', sub.estacion_transferencia,
            'tipoBarrido', sub.tipo_barrido,
            'estado', sub.estado
          ),
          'geometry', ST_AsGeoJSON(sub.geom)::json
        )
      ), '[]'::json)
    )::text AS geojson
    FROM (
      SELECT DISTINCT ON (m.id)
        m.id, m.nombre, m.tipo, m.fecha_operacion, m.dir_inicio, m.hora_inicio,
        m.dir_fin, m.hora_fin, m.dist_pavimentada, m.dist_no_pavimentada,
        m.frecuencia, m.dias_frecuencia, m.estacion_transferencia, m.tipo_barrido,
        m.estado, m.geom
      FROM microrrutas m
      ${joinClause}
      ${whereClause}
      ORDER BY m.id
    ) sub;
  `;

    return JSON.parse(rows[0].geojson) as GeoJsonFeatureCollection;
  }
}
