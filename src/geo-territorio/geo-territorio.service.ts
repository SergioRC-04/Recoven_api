import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FilterBarriosDto,
  FilterViasDto,
  GeoJsonFeatureCollection,
} from './dto/geo-territorio.dto';

@Injectable()
export class GeoTerritorioService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna todas las localidades como un FeatureCollection de GeoJSON
   */
  async getLocalidadesGeoJson() {
    try {
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
                'areaShape', st_area_shape
              ),
              'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::json
            )
          ), '[]'::json)
        )::text AS geojson
        FROM localidades;
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
   * Retorna los barrios como FeatureCollection, opcionalmente filtrados por localidad
   */
  async getBarriosGeoJson(filters: FilterBarriosDto) {
    try {
      const { localidadCod } = filters;

      const result = await this.prisma.$queryRaw<Array<{ geojson: string }>>`
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'id', id,
              'properties', json_build_object(
                'id', id,
                'nombre', nombre_barrio,
                'identificador', identificador,
                'localidadCod', localidad_cod,
                'observaciones', observaciones,
                'areaShape', st_area_shape
              ),
              'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::json
            )
          ), '[]'::json)
        )::text AS geojson
        FROM barrios
        WHERE (${localidadCod}::text IS NULL OR localidad_cod = ${localidadCod});
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
   * Retorna la red de vías como FeatureCollection, opcionalmente filtradas por intersección espacial
   * con la geometría de una localidad o de un barrio.
   */
  async getViasGeoJson(filters: FilterViasDto) {
    try {
      const { localidadCod, barrioCod } = filters;

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
          -- Filtrar por intersección con el barrio
          (${barrioCod}::text IS NULL OR EXISTS (
            SELECT 1 FROM barrios b 
            WHERE b.identificador = ${barrioCod} 
            AND ST_Intersects(v.geom, b.geom)
          ))
          AND
          -- Filtrar por intersección con la localidad
          (${localidadCod}::text IS NULL OR EXISTS (
            SELECT 1 FROM localidades l 
            WHERE l.identificador = ${localidadCod} 
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
}
