// prisma/seed-direcciones.ts
//
// Carga geodata/Direcciones_bq_magna.geojson (~500.000 puntos) a la tabla
// "direcciones". Mismo patrón de conexión que seed-geo.ts, pero NO copia su
// forma de insertar (un INSERT individual por fila, en tandas de 500
// concurrentes) — con 500.000 filas eso sería demasiado lento. Aquí se
// arma un solo INSERT ... VALUES (...), (...), ... por lote.
//
// A diferencia de Barrios/Localidades/Vías (ya en EPSG:9377, metros), este
// GeoJSON fuente declara CRS84 (lon/lat WGS84, igual orden que EPSG:4326)
// — por eso aquí SÍ hace falta ST_Transform(..., 4326, 9377), a diferencia
// del resto de seed-geo.ts.
//
// Uso:
//   npx ts-node prisma/seed-direcciones.ts
//
// El archivo es grande (~120MB) — si Node se queda sin memoria al parsear
// el JSON, correr con más heap:
//   node --max-old-space-size=4096 node_modules/.bin/ts-node prisma/seed-direcciones.ts
//
// Seguro de volver a correr: ON CONFLICT (global_id) DO UPDATE, no duplica.
//
// Reanudar tras un corte a mitad de camino (ya es idempotente por el
// ON CONFLICT, pero volver a insertar todo desde cero es lento con medio
// millón de filas): correr con --desde=<N>, el índice de feature por el
// que se quedó (lo imprime el propio script en cada lote), p. ej.:
//   npx ts-node prisma/seed-direcciones.ts --desde=467000
//
// Algunas direcciones de la fuente traen "geometry": null (sin coordenada
// registrada en ArcGIS) — se saltan con un aviso, no detienen el import.

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

interface DireccionProperties {
  direccion: string;
  sector_ciudad: string | null;
  globalid: string;
}

interface GeoFeature {
  type: string;
  properties: DireccionProperties;
  geometry: { type: string; coordinates: unknown };
}

interface GeoFeatureCollection {
  type: string;
  name?: string;
  features: GeoFeature[];
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida en el archivo .env');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BATCH_SIZE = 1000;

// Lee "--desde=N" de los argumentos (resumir un import cortado a mitad de
// camino) — 0 si no viene.
function leerDesde(): number {
  const arg = process.argv.find((a) => a.startsWith('--desde='));
  if (!arg) return 0;
  const n = parseInt(arg.split('=')[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function main(): Promise<void> {
  const direccionesPath = path.join(
    process.cwd(),
    'geodata/Direcciones_bq_magna.geojson',
  );
  if (!fs.existsSync(direccionesPath)) {
    throw new Error(`No se encontró ${direccionesPath}`);
  }

  console.log(
    '📦 Leyendo Direcciones_bq_magna.geojson (~120MB, puede tardar un momento)...',
  );
  const rawData = fs.readFileSync(direccionesPath, 'utf8');
  const geojson = JSON.parse(rawData) as GeoFeatureCollection;
  const features = geojson.features;

  const desde = leerDesde();
  console.log(
    `📍 ${features.length} direcciones en el archivo, en lotes de ${BATCH_SIZE}` +
      (desde > 0 ? ` (reanudando desde el índice ${desde})` : '') +
      '.\n',
  );

  let insertadas = 0;
  let sinGeometria = 0;

  for (let i = desde; i < features.length; i += BATCH_SIZE) {
    // Las que no tienen geometría (direcciones sin coordenada registrada
    // en la fuente) se saltan — ST_GeomFromGeoJSON no acepta geometry:
    // null, y no hay nada que insertar de todas formas sin un punto.
    const batchCrudo = features.slice(i, i + BATCH_SIZE);
    const batch = batchCrudo.filter((f) => f.geometry != null);
    sinGeometria += batchCrudo.length - batch.length;

    const filas = batch.map((feature) => {
      const p = feature.properties;
      const geomJson = JSON.stringify(feature.geometry);
      return Prisma.sql`(
        gen_random_uuid(),
        ${p.globalid},
        ${p.direccion},
        ${p.sector_ciudad ?? null},
        ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}), 4326), 9377)
      )`;
    });

    if (filas.length === 0) continue;

    try {
      await prisma.$executeRaw`
        INSERT INTO "direcciones" ("id", "global_id", "direccion", "sector_ciudad", "geom")
        VALUES ${Prisma.join(filas)}
        ON CONFLICT ("global_id") DO UPDATE SET
          "direccion" = EXCLUDED."direccion",
          "sector_ciudad" = EXCLUDED."sector_ciudad",
          "geom" = EXCLUDED."geom";
      `;
      insertadas += batch.length;
    } catch (error) {
      console.error(`❌ Error en el lote ${i} - ${i + batch.length}:`, error);
      throw error;
    }

    console.log(
      `  -> ${Math.min(i + BATCH_SIZE, features.length)} / ${features.length}`,
    );
  }

  console.log(
    `\n✅ Listo. ${insertadas} direcciones insertadas/actualizadas` +
      (sinGeometria > 0
        ? `, ${sinGeometria} omitidas por no tener geometría`
        : '') +
      '.',
  );
}

main()
  .catch((err) => {
    console.error('Error corriendo el script:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
