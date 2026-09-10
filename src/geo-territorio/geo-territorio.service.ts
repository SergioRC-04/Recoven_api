import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FilterLocalidadesDto,
  FilterBarriosDto,
  FilterViasDto,
  GeoJsonFeatureCollection,
} from './dto/geo-territorio.dto';

@Injectable()
export class GeoTerritorioService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna las localidades como un FeatureCollection de GeoJSON,
   * opcionalmente filtradas por municipio ("BARRANQUILLA" |
   * "PUERTO_COLOMBIA") — sin el filtro, trae las de ambos.
   */
  async getLocalidadesGeoJson(filters: FilterLocalidadesDto) {
    try {
      const { municipio } = filters;

      const result = await this.prisma.$queryRaw<Array<{ geojson: string }>>`
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'id', id,
              'properties', json_build_object(
                'id', id,
                'nombre', nombre,
                'identificador', identificador,
                'areaShape', st_area_shape,
                'municipio', municipio
              ),
              'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::json
            )
          ), '[]'::json)
        )::text AS geojson
        FROM localidades
        WHERE (${municipio}::text IS NULL OR municipio = ${municipio}::"Municipio");
      `;

      return JSON.parse(result[0].geojson) as GeoJsonFeatureCollection;
    } catch (error: unknown) {
      throw new InternalServerErrorException(
        'Error al obtener el GeoJSON de localidades',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  /**
   * Retorna los barrios como FeatureCollection, opcionalmente filtrados
   * por localidad y/o por municipio — ambos filtros son independientes y
   * se combinan (AND) si se dan los dos a la vez.
   */
  async getBarriosGeoJson(filters: FilterBarriosDto) {
    try {
      const { localidadCod, municipio } = filters;

      const result = await this.prisma.$queryRaw<Array<{ geojson: string }>>`
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'id', b.id,
              'properties', json_build_object(
                'id', b.id,
                'nombre', b.nombre_barrio,
                'identificador', b.identificador,
                'localidadCod', b.localidad_cod,
                'observaciones', b.observaciones,
                'areaShape', b.st_area_shape
              ),
              'geometry', ST_AsGeoJSON(ST_Transform(b.geom, 4326))::json
            )
            ORDER BY b.nombre_barrio ASC
          ), '[]'::json)
        )::text AS geojson
        FROM barrios b
        LEFT JOIN localidades l ON l.identificador = b.localidad_cod
        WHERE (${localidadCod}::text IS NULL OR b.localidad_cod = ${localidadCod})
          AND (${municipio}::text IS NULL OR l.municipio = ${municipio}::"Municipio");
      `;

      return JSON.parse(result[0].geojson) as GeoJsonFeatureCollection;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al obtener el GeoJSON de barrios',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  /**
   * Retorna la red de vías como FeatureCollection, opcionalmente
   * filtradas por intersección espacial con una localidad o un barrio, y/o
   * por municipio (independiente de los otros dos — sirve para "todas las
   * vías de Puerto Colombia" sin elegir una localidad/barrio puntual; hoy
   * esto siempre da vacío para Puerto Colombia, porque no se cargó
   * ninguna vía ahí).
   */
  async getViasGeoJson(filters: FilterViasDto) {
    try {
      const { localidadCod, barrioCod, municipio } = filters;

      const result = await this.prisma.$queryRaw<Array<{ geojson: string }>>`
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'id', v.id,
              'properties', json_build_object(
                'id', v.id,
                'texto', v.texto,
                'abrTexto', v.abr_texto,
                'shapeLen', v.shape_len
              ),
              'geometry', ST_AsGeoJSON(ST_Transform(v.geom, 4326))::json
            )
          ), '[]'::json)
        )::text AS geojson
        FROM vias v
        WHERE 
          (${barrioCod}::text IS NULL OR EXISTS (
            SELECT 1 FROM barrios b 
            WHERE b.identificador = ${barrioCod} 
            AND ST_Intersects(v.geom, b.geom)
          ))
          AND
          (${localidadCod}::text IS NULL OR EXISTS (
            SELECT 1 FROM localidades l 
            WHERE l.identificador = ${localidadCod} 
            AND ST_Intersects(v.geom, l.geom)
          ))
          AND
          (${municipio}::text IS NULL OR EXISTS (
            SELECT 1 FROM localidades l
            WHERE l.municipio = ${municipio}::"Municipio"
            AND ST_Intersects(v.geom, l.geom)
          ));
      `;

      return JSON.parse(result[0].geojson) as GeoJsonFeatureCollection;
    } catch (error: unknown) {
      throw new InternalServerErrorException(
        'Error al obtener el GeoJSON de vías',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  /**
   * Igual que getLocalidadesGeoJson, pero sin reproyectar — se usa para
   * exportar (GeoJSON/Shapefile), donde se quiere la geometría nativa en
   * EPSG:9377, no la 4326 que consume el mapa interactivo.
   */
  async getLocalidadesGeoJsonNativo(filters: FilterLocalidadesDto) {
    try {
      const { municipio } = filters;

      const result = await this.prisma.$queryRaw<Array<{ geojson: string }>>`
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(json_agg(
          json_build_object(
            'type', 'Feature',
            'id', id,
            'properties', json_build_object(
              'id', id,
              'nombre', nombre,
              'identificador', identificador,
              'areaShape', st_area_shape,
              'municipio', municipio
            ),
            'geometry', ST_AsGeoJSON(geom)::json
          )
        ), '[]'::json)
      )::text AS geojson
      FROM localidades
      WHERE (${municipio}::text IS NULL OR municipio = ${municipio}::"Municipio");
    `;
      return JSON.parse(result[0].geojson) as GeoJsonFeatureCollection;
    } catch (error: unknown) {
      throw new InternalServerErrorException(
        'Error al obtener el GeoJSON nativo de localidades',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  async getBarriosGeoJsonNativo(filters: FilterBarriosDto) {
    try {
      const { localidadCod, municipio } = filters;
      const result = await this.prisma.$queryRaw<Array<{ geojson: string }>>`
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(json_agg(
          json_build_object(
            'type', 'Feature',
            'id', b.id,
            'properties', json_build_object(
              'id', b.id,
              'nombre', b.nombre_barrio,
              'identificador', b.identificador,
              'localidadCod', b.localidad_cod,
              'observaciones', b.observaciones,
              'areaShape', b.st_area_shape
            ),
            'geometry', ST_AsGeoJSON(b.geom)::json
          )
        ), '[]'::json)
      )::text AS geojson
      FROM barrios b
      LEFT JOIN localidades l ON l.identificador = b.localidad_cod
      WHERE (${localidadCod}::text IS NULL OR b.localidad_cod = ${localidadCod})
        AND (${municipio}::text IS NULL OR l.municipio = ${municipio}::"Municipio");
    `;
      return JSON.parse(result[0].geojson) as GeoJsonFeatureCollection;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al obtener el GeoJSON nativo de barrios',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }

  async getViasGeoJsonNativo(filters: FilterViasDto) {
    try {
      const { localidadCod, barrioCod, municipio } = filters;
      const result = await this.prisma.$queryRaw<Array<{ geojson: string }>>`
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(json_agg(
          json_build_object(
            'type', 'Feature',
            'id', v.id,
            'properties', json_build_object(
              'id', v.id,
              'texto', v.texto,
              'abrTexto', v.abr_texto,
              'shapeLen', v.shape_len
            ),
            'geometry', ST_AsGeoJSON(v.geom)::json
          )
        ), '[]'::json)
      )::text AS geojson
      FROM vias v
      WHERE
        (${barrioCod}::text IS NULL OR EXISTS (
          SELECT 1 FROM barrios b
          WHERE b.identificador = ${barrioCod}
          AND ST_Intersects(v.geom, b.geom)
        ))
        AND
        (${localidadCod}::text IS NULL OR EXISTS (
          SELECT 1 FROM localidades l
          WHERE l.identificador = ${localidadCod}
          AND ST_Intersects(v.geom, l.geom)
        ))
        AND
        (${municipio}::text IS NULL OR EXISTS (
          SELECT 1 FROM localidades l
          WHERE l.municipio = ${municipio}::"Municipio"
          AND ST_Intersects(v.geom, l.geom)
        ));
    `;
      return JSON.parse(result[0].geojson) as GeoJsonFeatureCollection;
    } catch (error: unknown) {
      throw new InternalServerErrorException(
        'Error al obtener el GeoJSON nativo de vías',
        error instanceof Error ? error.message : 'Error desconocido',
      );
    }
  }
}
