// prisma/backfill-microrruta-direcciones.ts
//
// Script de un solo uso: calcula dirInicio/dirFin para las microrrutas que
// ya existen (creadas antes de que este cálculo fuera automático en
// create()/updateGeom(), o cuyo valor manual no coincide con la dirección
// más cercana real — ver src/microrrutas/utils/microrrutas-direcciones.util.ts,
// misma lógica que usa este script). Requiere que la tabla "direcciones"
// ya esté cargada (prisma/seed-direcciones.ts).
//
// Por defecto SOLO MUESTRA un reporte de lo que cambiaría, sin tocar nada.
// Para aplicarlo de verdad, se corre de nuevo con --aplicar.
//
// Uso:
//   npx ts-node prisma/backfill-microrruta-direcciones.ts            (vista previa)
//   npx ts-node prisma/backfill-microrruta-direcciones.ts --aplicar  (aplica)

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { calcularYGuardarDireccionesMicrorruta } from '../src/microrrutas/utils/microrrutas-direcciones.util';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const APLICAR = process.argv.includes('--aplicar');

interface ExtremoCalculado {
  tipo: 'inicio' | 'fin';
  direccion: string | null;
}

async function calcular(
  microrrutaId: number,
): Promise<{ dirInicio: string | null; dirFin: string | null }> {
  const resultados = await prisma.$queryRaw<ExtremoCalculado[]>`
    SELECT
      extremos.tipo,
      direccion_cercana.direccion AS direccion
    FROM microrrutas m
    CROSS JOIN LATERAL (
      VALUES
        ('inicio', ST_StartPoint(m.geom)),
        ('fin', ST_EndPoint(m.geom))
    ) AS extremos(tipo, punto)
    LEFT JOIN LATERAL (
      SELECT d.direccion
      FROM direcciones d
      WHERE ST_DWithin(d.geom, extremos.punto, 50)
      ORDER BY ST_Distance(d.geom, extremos.punto) ASC
      LIMIT 1
    ) direccion_cercana ON true
    WHERE m.id = ${microrrutaId};
  `;
  return {
    dirInicio: resultados.find((r) => r.tipo === 'inicio')?.direccion ?? null,
    dirFin: resultados.find((r) => r.tipo === 'fin')?.direccion ?? null,
  };
}

interface MicrorrutaConGeom {
  id: number;
  nombre: string;
  dirInicio: string | null;
  dirFin: string | null;
}

async function main() {
  // geom es Unsupported en el schema de Prisma (PostGIS) — no se puede
  // filtrar/seleccionar con la API de modelo, de ahí el $queryRaw.
  //
  // La capa de direcciones solo cubre Barranquilla (Direcciones_bq_magna)
  // — se excluyen las microrrutas de Puerto Colombia (mismo criterio ya
  // usado en microrrutas.service.ts findAll() para filtrar por
  // municipio: microrruta -> microrruta_barrio -> barrios -> localidades
  // -> municipio) para no calcularles ni tocarles dirInicio/dirFin.
  const microrrutas = await prisma.$queryRaw<MicrorrutaConGeom[]>`
    SELECT m.id, m.nombre, m.dir_inicio AS "dirInicio", m.dir_fin AS "dirFin"
    FROM microrrutas m
    WHERE m.geom IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM microrruta_barrio mb
        JOIN barrios b ON b.identificador = mb.barrio_id
        JOIN localidades l ON l.identificador = b.localidad_cod
        WHERE mb.microrruta_id = m.id AND l.municipio = 'PUERTO_COLOMBIA'::"Municipio"
      )
    ORDER BY m.id;
  `;

  console.log(
    `${APLICAR ? 'APLICANDO' : 'VISTA PREVIA (sin --aplicar, no se cambia nada)'} — ` +
      `${microrrutas.length} microrrutas con geometría (excluidas las de Puerto Colombia).\n`,
  );

  let cambiarian = 0;

  for (const m of microrrutas) {
    const { dirInicio, dirFin } = await calcular(m.id);
    const coincide = m.dirInicio === dirInicio && m.dirFin === dirFin;
    if (coincide) continue;

    cambiarian++;
    console.log(
      `  "${m.nombre}" (id ${m.id}):\n` +
        `    inicio: ${m.dirInicio ?? '(vacío)'}  →  ${dirInicio ?? ''}\n` +
        `    fin:    ${m.dirFin ?? '(vacío)'}  →  ${dirFin ?? ''}`,
    );

    if (APLICAR) {
      await calcularYGuardarDireccionesMicrorruta(prisma, m.id);
    }
  }

  console.log(
    `\n${cambiarian} de ${microrrutas.length} microrrutas ${APLICAR ? 'actualizadas' : 'cambiarían'}.`,
  );
  if (!APLICAR && cambiarian > 0) {
    console.log(
      'Revisa la lista de arriba y, si está bien, corre de nuevo con --aplicar.',
    );
  }
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
