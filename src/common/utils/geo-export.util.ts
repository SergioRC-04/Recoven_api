import * as shpwrite from '@mapbox/shp-write';
import type { Response } from 'express';

// WKT de EPSG:9377 (MAGNA-SIRGAS Origen Nacional) — el sistema oficial
// colombiano, el mismo en que Postgres guarda las geometrías nativamente.
// shp-write no lo conoce por defecto, así que se pasa explícito.
export const EPSG_9377_WKT =
  'PROJCS["MAGNA-SIRGAS_Origen_Nacional",GEOGCS["GCS_MAGNA-SIRGAS",DATUM["D_MAGNA-SIRGAS",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",5000000.0],PARAMETER["False_Northing",2000000.0],PARAMETER["Central_Meridian",-73.0],PARAMETER["Scale_Factor",0.9992],PARAMETER["Latitude_Of_Origin",4.0],UNIT["Meter",1.0],AUTHORITY["EPSG",9377]]';

// ⚠️ @mapbox/shp-write usa la clave "polyline" para líneas, no "line"
// (confirmado en su propio README) — ojo si copias este patrón a otro lado.
export type TipoGeometriaShapefile = 'point' | 'polyline' | 'polygon';

interface GeoJsonFeatureCollectionLike {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id?: string | number;
    geometry?: { type: string; coordinates: unknown } | null;
    properties?: Record<string, unknown>;
  }>;
}

export type FormatoExport = 'geojson' | 'shp';

export function parseFormatoExport(formato: string | undefined): FormatoExport {
  return formato === 'shp' ? 'shp' : 'geojson';
}

/**
 * Los campos DBF de un Shapefile solo admiten nombres de hasta 10
 * caracteres — GeoJSON no tiene ese límite, así que las propiedades llegan
 * aquí con nombres completos y legibles (p. ej. "estacionTransferencia").
 * Arma el mapeo nombre-completo → nombre-corto una sola vez (a partir del
 * primer feature, ya que todos comparten las mismas propiedades) y evita
 * colisiones si dos nombres distintos truncarían al mismo valor.
 */
function acortarPropiedadesParaDbf(
  features: GeoJsonFeatureCollectionLike['features'],
): GeoJsonFeatureCollectionLike['features'] {
  if (features.length === 0) return features;

  const nombresOriginales = Object.keys(features[0].properties ?? {});
  const mapa = new Map<string, string>();
  const usados = new Set<string>();

  for (const nombre of nombresOriginales) {
    if (nombre.length <= 10) {
      mapa.set(nombre, nombre);
      usados.add(nombre);
      continue;
    }
    let corto = nombre.slice(0, 10);
    let i = 1;
    while (usados.has(corto) && i < 100) {
      corto = `${nombre.slice(0, 8)}${String(i).padStart(2, '0')}`;
      i++;
    }
    mapa.set(nombre, corto);
    usados.add(corto);
  }

  return features.map((f) => {
    if (!f.properties) return f;
    const nuevasProps: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f.properties)) {
      nuevasProps[mapa.get(k) ?? k] = v;
    }
    return { ...f, properties: nuevasProps };
  });
}

/**
 * Convierte un FeatureCollection GeoJSON (ya en EPSG:9377 — no reproyecta,
 * Postgres ya lo entrega así) a un Shapefile empaquetado en ZIP. Normaliza
 * Polygon → MultiPolygon porque shp-write necesita un solo tipo de
 * geometría consistente por capa.
 */
export async function generarShapefileZip(
  geojson: GeoJsonFeatureCollectionLike,
  nombreCapa: string,
  tipoGeometria: TipoGeometriaShapefile,
): Promise<Buffer> {
  const copia = structuredClone(geojson);

  copia.features.forEach((f) => {
    if (f.geometry?.type === 'Polygon') {
      f.geometry.type = 'MultiPolygon';
      f.geometry.coordinates = [f.geometry.coordinates];
    }
  });

  copia.features = acortarPropiedadesParaDbf(copia.features); // ← línea nueva

  // outputType/compression son obligatorios según los tipos que trae la
  // librería (aunque el ejemplo del README los muestre sin ellos).
  // 'arraybuffer' es el formato correcto para Node — ya lo asumíamos en el
  // Buffer.from de abajo. STORE en vez de DEFLATE porque el propio README
  // de la librería advierte que la compresión DEFLATE es "buggy".
  const options = {
    outputType: 'arraybuffer',
    compression: 'STORE',
    types: { [tipoGeometria]: nombreCapa },
    prj: EPSG_9377_WKT,
  } as shpwrite.ZipOptions & shpwrite.DownloadOptions;

  const zipData = await shpwrite.zip(copia, options);
  return Buffer.from(zipData as ArrayBuffer);
}

/**
 * Envía la respuesta HTTP de un export: Shapefile (zip) o GeoJSON (con el
 * miembro `crs` apuntando a EPSG:9377 para herramientas SIG que todavía lo
 * respetan — no es parte del estándar GeoJSON vigente, pero aquí es un
 * requisito del flujo de trabajo, no un descuido).
 */
export async function responderExportGeo(
  res: Response,
  geojson: GeoJsonFeatureCollectionLike,
  formato: FormatoExport,
  nombreArchivo: string,
  tipoGeometria: TipoGeometriaShapefile,
): Promise<void> {
  if (formato === 'shp') {
    const buffer = await generarShapefileZip(
      geojson,
      nombreArchivo,
      tipoGeometria,
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreArchivo}.zip"`,
    );
    res.send(buffer);
    return;
  }

  const geojsonConCrs = {
    ...geojson,
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::9377' } },
  };
  res.setHeader('Content-Type', 'application/geo+json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${nombreArchivo}.geojson"`,
  );
  res.send(JSON.stringify(geojsonConCrs, null, 2));
}
