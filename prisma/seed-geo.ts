import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// -----------------------------------------------------------------------------
// Tipos e Interfaces GeoJSON
// -----------------------------------------------------------------------------
interface GeometryJSON {
  type: string;
  coordinates: unknown;
}

interface LocalidadProperties {
  objectid: number;
  nombre: string;
  identificador: string | number;
  'st_area(shape)'?: number;
}

interface BarrioProperties {
  objectid: number;
  identificador: string | number;
  nombre_barrio: string;
  nombre_pieza?: number;
  localidad: string | number;
  observaciones?: string;
  'st_area(shape)'?: number;
}

interface ViaProperties {
  OBJECTID: number;
  TEXTO?: string;
  ABR_TEXTO?: string;
  Shape__Len?: number;
}

interface GeoFeature<T> {
  type: string;
  properties: T;
  geometry: GeometryJSON;
}

interface GeoFeatureCollection<T> {
  type: string;
  name?: string;
  features: GeoFeature<T>[];
}

// -----------------------------------------------------------------------------
// Inicialización del Cliente
// -----------------------------------------------------------------------------
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida en el archivo .env');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log('🚀 Iniciando la migración de archivos GeoJSON a PostGIS...');

  // ---------------------------------------------------------------------------
  // 1. CARGAR LOCALIDADES
  // ---------------------------------------------------------------------------
  const localidadesPath = path.join(
    process.cwd(),
    'geodata/Localidades-Magna-Sirgas.geojson',
  );
  console.log('Ruta buscada:', localidadesPath);
  console.log('¿Existe?:', fs.existsSync(localidadesPath));

  if (fs.existsSync(localidadesPath)) {
    console.log('📦 Insertando Localidades...');
    const rawData = fs.readFileSync(localidadesPath, 'utf8');
    const geojson = JSON.parse(
      rawData,
    ) as GeoFeatureCollection<LocalidadProperties>;

    for (const feature of geojson.features) {
      const p = feature.properties;
      const geomJson = JSON.stringify(feature.geometry);

      const objectId = p.objectid;
      const nombre = p.nombre;
      const identificador = String(p.identificador);
      const areaShape = p['st_area(shape)'] ?? null;

      try {
        await prisma.$executeRaw`
          INSERT INTO "localidades" ("id", "object_id", "nombre", "identificador", "st_area_shape", "geom")
          VALUES (
            gen_random_uuid(),
            ${objectId},
            ${nombre},
            ${identificador},
            ${areaShape},
            ST_Multi(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}), 9377)))
          )
          ON CONFLICT ("identificador") DO UPDATE SET
            "nombre" = EXCLUDED."nombre",
            "geom" = EXCLUDED."geom";
        `;
      } catch (error: unknown) {
        console.error('❌ Error al insertar Localidad:', {
          propiedades: p,
          error: error instanceof Error ? error.message : error,
        });
      }
    }
    console.log('✅ Localidades procesadas.');
  }

  // ---------------------------------------------------------------------------
  // 2. CARGAR BARRIOS
  // ---------------------------------------------------------------------------
  const barriosPath = path.join(
    process.cwd(),
    'geodata/Barrios-Magna-Sirgas.geojson',
  );
  if (fs.existsSync(barriosPath)) {
    console.log('📦 Insertando Barrios...');
    const rawData = fs.readFileSync(barriosPath, 'utf8');
    const geojson = JSON.parse(
      rawData,
    ) as GeoFeatureCollection<BarrioProperties>;

    for (const feature of geojson.features) {
      const p = feature.properties;
      const geomJson = JSON.stringify(feature.geometry);

      const objectId = p.objectid;
      const identificador = String(p.identificador);
      const nombreBarrio = p.nombre_barrio;
      const nombrePieza = p.nombre_pieza ?? null;
      const localidadCod = String(p.localidad);
      const observaciones = p.observaciones ?? null;
      const areaShape = p['st_area(shape)'] ?? null;

      try {
        await prisma.$executeRaw`
          INSERT INTO "barrios" ("id", "object_id", "identificador", "nombre_barrio", "nombre_pieza", "localidad_cod", "observaciones", "st_area_shape", "geom")
          VALUES (
            gen_random_uuid(),
            ${objectId},
            ${identificador},
            ${nombreBarrio},
            ${nombrePieza},
            ${localidadCod},
            ${observaciones},
            ${areaShape},
            ST_Multi(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}), 9377)))
          );
        `;
      } catch (error: unknown) {
        console.error('❌ Error al insertar Barrio:', {
          registroFallido: {
            objectId,
            identificador,
            nombreBarrio,
            localidadCod,
            observaciones,
            areaShape,
          },
          error: error instanceof Error ? error.message : error,
        });
      }
    }
    console.log('✅ Barrios procesados.');
  }

  // ---------------------------------------------------------------------------
  // 3. CARGAR VÍAS (En lotes con Promise.allSettled)
  // ---------------------------------------------------------------------------
  const viasPath = path.join(process.cwd(), 'geodata/Vias.geojson');
  if (fs.existsSync(viasPath)) {
    console.log('📦 Insertando Vías (6.1MB)...');
    const rawData = fs.readFileSync(viasPath, 'utf8');
    const geojson = JSON.parse(rawData) as GeoFeatureCollection<ViaProperties>;

    const BATCH_SIZE = 500;
    const features = geojson.features;

    for (let i = 0; i < features.length; i += BATCH_SIZE) {
      const batch = features.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (feature) => {
          const p = feature.properties;
          const geomJson = JSON.stringify(feature.geometry);

          const objectId = p.OBJECTID;
          const texto = p.TEXTO ?? null;
          const abrTexto = p.ABR_TEXTO ?? null;
          const shapeLen = p.Shape__Len ?? null;

          try {
            await prisma.$executeRaw`
              INSERT INTO "vias" ("id", "object_id", "texto", "abr_texto", "shape_len", "geom")
              VALUES (
                gen_random_uuid(),
                ${objectId},
                ${texto},
                ${abrTexto},
                ${shapeLen},
                ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}), 9377))
              );
            `;
          } catch (error) {
            console.error('❌ Error al insertar Vía:', {
              propiedades: p,
            });
            throw error; // Para que Promise.allSettled detecte el fallo
          }
        }),
      );

      // Reporte de cuántas fallaron en este lote si aplica
      const rechazados = results.filter((r) => r.status === 'rejected');
      if (rechazados.length > 0) {
        console.warn(
          `⚠️ Se detectaron ${rechazados.length} fallos en el lote ${i} - ${i + batch.length}`,
        );
      }

      console.log(
        `  -> Procesadas ${Math.min(i + BATCH_SIZE, features.length)} / ${features.length} vías`,
      );
    }
    console.log('✅ Vías procesadas.');
  }

  console.log('🎉 Migración geoespacial completada.');
}

main()
  .catch((e: unknown) => {
    console.error('❌ Error crítico en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
