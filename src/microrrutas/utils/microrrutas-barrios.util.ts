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
//
// Además, al final determina y guarda la MACRORRUTA de la ruta: la
// localidad "dueña" es simplemente la del barrio seleccionado con mayor
// longitud_real — cada barrio ya sabe a qué localidad pertenece
// (Barrios.localidadCod), así que no hace falta ninguna consulta
// geométrica aparte contra el polígono de la localidad. Si todos los
// barrios de la ruta son de la misma localidad (el caso normal), esto
// simplemente devuelve esa localidad sin ambigüedad.

import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

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

// Cuántas veces reintentar generar un número de macrorruta aleatorio si
// choca con uno ya existente — con ~90 millones de combinaciones posibles
// y apenas un puñado de localidades en total, un choque es prácticamente
// imposible, pero el número es único en la tabla y hay que cubrir el caso.
const MAX_INTENTOS_NUMERO_MACRORRUTA = 10;

interface CandidatoBarrio {
  barrio_id: string;
  localidad_cod: string;
  longitud_erosionada: number;
  longitud_real: number;
}

/**
 * Genera un número de macrorruta aleatorio de 8 dígitos (entre 10000000 y
 * 99999999 — nunca empieza en 0, para que sean siempre 8 dígitos de
 * verdad y no un número más corto con ceros a la izquierda). Se ve más
 * "profesional" que un simple correlativo (10000001, 10000002, ...) sin
 * dejar de ser un valor de 8 dígitos único y estable una vez asignado.
 */
function generarNumeroMacrorrutaAleatorio(): string {
  const numero = Math.floor(10_000_000 + Math.random() * 90_000_000);
  return String(numero);
}

/**
 * Encuentra la macrorruta de una localidad, creándola si todavía no
 * existe, y devuelve su id — para que el llamador lo guarde directo en
 * microrruta.macrorrutaId. Cada macrorruta ES una localidad
 * (localidadCod es único en la tabla), así que nunca se crea una segunda
 * para la misma. No se borra nunca una macrorruta ya creada — si más
 * adelante otra microrruta vuelve a caer en esa misma localidad,
 * reutiliza el mismo id/número en vez de generar uno nuevo, y si
 * mientras tanto ninguna microrruta cae ahí, la fila simplemente no se
 * referencia desde ningún lado (no aparece en el mapa ni en los
 * filtros, sin necesidad de borrarla).
 */
async function obtenerOCrearMacrorruta(
  prisma: PrismaClient,
  localidadCod: string,
): Promise<number> {
  const existente = await prisma.macrorruta.findUnique({
    where: { localidadCod },
  });
  if (existente) return existente.id;

  for (let intento = 0; intento < MAX_INTENTOS_NUMERO_MACRORRUTA; intento++) {
    const numero = generarNumeroMacrorrutaAleatorio();
    try {
      const creada = await prisma.macrorruta.create({
        data: { localidadCod, numero },
      });
      return creada.id;
    } catch (error) {
      // P2002 = violación de restricción única — el número aleatorio ya
      // estaba tomado por otra macrorruta. Se reintenta con uno nuevo.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `No se pudo generar un número de macrorruta único para la localidad ${localidadCod} ` +
      `tras ${MAX_INTENTOS_NUMERO_MACRORRUTA} intentos.`,
  );
}

/**
 * Localidad "dueña" de la macrorruta de la ruta: la del barrio
 * seleccionado (ver seleccionados más abajo) con mayor longitud_real. No
 * hace falta ninguna consulta aparte — cada candidato ya trae su propio
 * localidad_cod desde la misma consulta que decide qué barrios le
 * pertenecen a la ruta.
 */
function elegirLocalidadDominante(
  seleccionados: CandidatoBarrio[],
): string | null {
  if (seleccionados.length === 0) return null;
  const conMasLongitud = seleccionados.reduce((mejor, actual) =>
    actual.longitud_real > mejor.longitud_real ? actual : mejor,
  );
  return conMasLongitud.localidad_cod;
}

export async function calcularYGuardarBarriosMicrorruta(
  prisma: PrismaClient,
  microrrutaId: number,
): Promise<void> {
  const candidatos = await prisma.$queryRaw<CandidatoBarrio[]>`
    SELECT
      b.identificador AS barrio_id,
      b.localidad_cod AS localidad_cod,
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

  // Depende de `seleccionados` recién calculado arriba — no de una
  // consulta nueva ni de MicrorrutaBarrio ya guardado, así que puede
  // correr inmediatamente después, sin esperar a que la transacción se
  // refleje en una lectura posterior.
  const localidadDominante = elegirLocalidadDominante(seleccionados);

  const macrorrutaId = localidadDominante
    ? await obtenerOCrearMacrorruta(prisma, localidadDominante)
    : null;

  await prisma.microrruta.update({
    where: { id: microrrutaId },
    data: { macrorrutaId },
  });
}
