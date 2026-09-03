// src/microrrutas/utils/microrrutas-barrios.util.ts
//
// Calcula y guarda en MicrorrutaBarrio el o los barrios por los que
// efectivamente transcurre una microrruta. Extraído a su propio archivo
// (en vez de vivir como método privado de MicrorrutasService) para poder
// reutilizarlo tal cual desde el script de respaldo
// (prisma/backfill-microrruta-barrios.ts) sin duplicar la lógica ni
// depender de instanciar el servicio completo de NestJS fuera de su
// contexto normal.
//
// Estrategia (dos niveles):
// 1. Se compara la ruta contra una versión "erosionada" de cada barrio
//    candidato (el polígono encogido hacia adentro por BUFFER_EROSION_M
//    metros). Esto ignora cualquier tramo de la ruta que solo esté pegado
//    al límite compartido con otro barrio, sin adentrarse de verdad — así
//    una ruta que sale de un barrio, corre un trecho por el borde y
//    vuelve a entrar al mismo barrio no termina contando también al
//    vecino, aunque técnicamente lo haya tocado.
// 2. Si NINGÚN barrio supera el mínimo (LONGITUD_MINIMA_M) con la versión
//    erosionada — el caso límite de una ruta que transcurre enteramente
//    sobre el límite compartido entre dos barrios, sin adentrarse en
//    ninguno — se cae a un respaldo: se usa la intersección real, sin
//    erosionar, contra el mismo mínimo. Ahí sí calificarán ambos barrios,
//    reflejando honestamente que la ruta corre sobre su frontera común.

import type { PrismaClient } from '@prisma/client';

// Profundidad de la erosión, en metros (negativo: encoge el polígono hacia
// adentro). ~8m se acerca al ancho de una calle residencial en
// Barranquilla — una forma razonable de decir "ya cruzó la calle que marca
// el límite". Ajustable si, al revisar resultados reales, resulta muy
// corto o muy largo.
const BUFFER_EROSION_M = -8;

// Longitud mínima, en metros, que debe tener la intersección para que un
// barrio se considere parte de la ruta (evita que un roce de un par de
// metros más allá del buffer cuente como "la ruta pasa por ahí").
const LONGITUD_MINIMA_M = 25;

interface CandidatoBarrio {
  barrio_id: string;
  longitud_erosionada: number;
  longitud_real: number;
}

export async function calcularYGuardarBarriosMicrorruta(
  prisma: PrismaClient,
  microrrutaId: number,
): Promise<void> {
  const candidatos = await prisma.$queryRaw<CandidatoBarrio[]>`
    SELECT
      b.identificador AS barrio_id,
      COALESCE(
        ST_Length(ST_Intersection(m.geom, ST_Buffer(b.geom, ${BUFFER_EROSION_M}))),
        0
      ) AS longitud_erosionada,
      COALESCE(ST_Length(ST_Intersection(m.geom, b.geom)), 0) AS longitud_real
    FROM microrrutas m
    JOIN barrios b ON ST_Intersects(m.geom, b.geom)
    WHERE m.id = ${microrrutaId};
  `;

  const calificanErosionados = candidatos.filter(
    (c) => c.longitud_erosionada >= LONGITUD_MINIMA_M,
  );

  let seleccionados = calificanErosionados;
  if (seleccionados.length === 0) {
    seleccionados = candidatos.filter(
      (c) => c.longitud_real >= LONGITUD_MINIMA_M,
    );
    if (seleccionados.length > 0) {
      console.log(
        `[microrrutas] Ruta ${microrrutaId}: ningún barrio superó el mínimo erosionado; ` +
          `se usó el respaldo sin erosionar (${seleccionados.length} barrio(s) calificado(s): ` +
          `${seleccionados.map((s) => s.barrio_id).join(', ')}).`,
      );
    }
  }

  await prisma.$transaction([
    prisma.microrrutaBarrio.deleteMany({ where: { microrrutaId } }),
    ...(seleccionados.length > 0
      ? [
          prisma.microrrutaBarrio.createMany({
            data: seleccionados.map((s) => ({
              microrrutaId,
              barrioId: s.barrio_id,
            })),
          }),
        ]
      : []),
  ]);
}
