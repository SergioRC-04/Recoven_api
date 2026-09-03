// prisma/backfill-microrruta-barrios.ts
//
// Script de un solo uso: calcula y guarda los barrios de todas las
// microrrutas que ya existen en la base de datos — las creadas antes de
// que este cálculo se volviera automático en create()/updateGeom()
// (ver microrrutas-barrios.util.ts, misma función que usa este script).
//
// Uso:
//   npx ts-node prisma/backfill-microrruta-barrios.ts
//
// Es seguro volver a correrlo más de una vez: cada llamada a
// calcularYGuardarBarriosMicrorruta borra primero los barrios existentes
// de esa ruta antes de insertar los nuevos, así que no se duplica nada.

// Necesario porque el script corre suelto con ts-node, fuera del
// bootstrap de Nest (main.ts) — sin esto, process.env.DATABASE_URL
// llegaría undefined.
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { calcularYGuardarBarriosMicrorruta } from '../src/microrrutas/utils/microrrutas-barrios.util';

// Mismo patrón de conexión que PrismaService (src/prisma/prisma.service.ts)
// — el datasource del schema no tiene `url`, así que PrismaClient necesita
// el adaptador explícito, no puede conectarse solo con un new PrismaClient().
const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const microrrutas = await prisma.microrruta.findMany({
    select: { id: true, nombre: true },
    orderBy: { id: 'asc' },
  });

  console.log(
    `Se encontraron ${microrrutas.length} microrrutas. Calculando barrios...\n`,
  );

  let procesadas = 0;
  let conError = 0;

  for (const mr of microrrutas) {
    try {
      await calcularYGuardarBarriosMicrorruta(prisma, mr.id);
      procesadas++;
      console.log(
        `  [${procesadas}/${microrrutas.length}] "${mr.nombre}" (id ${mr.id}) — listo`,
      );
    } catch (error) {
      conError++;
      console.error(`  [ERROR] "${mr.nombre}" (id ${mr.id}):`, error);
    }
  }

  console.log(
    `\nListo. ${procesadas} procesadas correctamente, ${conError} con error.`,
  );
  if (conError > 0) {
    console.log(
      'Revisa los errores de arriba — probablemente rutas sin geometría válida.',
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
  });
