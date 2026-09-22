// src/microrrutas/utils/microrrutas-vias.util.ts
//
// Calcula y guarda en Microrruta.guiaCalles la guía de calles de una
// microrruta, a partir de su trazo (LineString). Mismo patrón que
// microrrutas-barrios.util.ts: corre UNA SOLA VEZ, al crear la ruta o al
// redibujar su trazo — nunca en cada lectura.
//
// Estrategia:
// 1. Se muestrea el trazo en puntos regulares cada INTERVALO_MUESTREO_M
//    metros (ST_LineInterpolatePoint sobre fracciones 0..1 del largo
//    total), EN ORDEN — el orden de generate_series(0, numPuntos) sigue
//    el mismo sentido que las coordenadas del LineString, que es el
//    sentido real del recorrido.
// 2. Para cada punto se busca la vía más cercana (tabla `vias`) dentro de
//    TOLERANCIA_VIA_M metros — el trazo dibujado a mano no calza exacto
//    sobre la vía oficial, así que se necesita margen.
// 3. Se recorren los puntos en orden y se agrupan los consecutivos que
//    caen en la misma vía en un solo paso. Una racha demasiado corta
//    (menos de MIN_MUESTRAS_POR_PASO puntos seguidos) NO se acepta como
//    paso propio — se fusiona con el paso anterior — porque casi siempre
//    es una calle/carrera que la ruta solo CRUZA de pasada cerca de una
//    intersección (donde dos vías quedan muy cerca del mismo punto y
//    "la más cercana" puede tocarle a la que cruza, no a la que la ruta
//    realmente recorre), no un tramo que de verdad recorre. Nunca se
//    repite el mismo nombre en dos pasos seguidos.
// 4. Si un punto no tiene ninguna vía dentro de la tolerancia, ese tramo
//    se guarda como "Tramo no identificado — seguir el mapa" en vez de
//    omitirse en silencio.

import type { Prisma, PrismaClient } from '@prisma/client';

// Distancia entre puntos de muestreo a lo largo del trazo, en metros.
// Suficientemente fino para no saltarse un cruce de calle corto, sin
// disparar el número de consultas por vía innecesariamente.
const INTERVALO_MUESTREO_M = 12;

// Tolerancia, en metros, para considerar que un punto del trazo
// "pertenece" a una vía oficial cercana — el trazo dibujado a mano rara
// vez calza exacto sobre la geometría de `vias`. Exportada porque
// GeoTerritorioService la reutiliza para filtrar "vías cercanas a esta
// microrruta" en el mapa (mismo criterio de cercanía, no debe divergir).
export const TOLERANCIA_VIA_M = 18;

// Mínimo de muestras SEGUIDAS en la misma vía para aceptarla como un paso
// real de la guía — con INTERVALO_MUESTREO_M = 12, 3 muestras equivalen a
// ~36 metros seguidos. Una cuadra típica mide 80-150m, así que un giro de
// verdad (la ruta gira y recorre la nueva calle) los supera sin problema;
// un simple cruce de pasada por una intersección normalmente solo alcanza
// a "tocar" 1-2 muestras antes de que la ruta siga por donde ya iba.
const MIN_MUESTRAS_POR_PASO = 3;

const TEXTO_TRAMO_NO_IDENTIFICADO = 'Tramo no identificado — seguir el mapa';

interface PuntoMuestreo {
  punto_orden: number;
  via_texto: string | null;
  via_abr_texto: string | null;
}

export interface PasoGuiaCalles {
  orden: number;
  texto: string;
  abrTexto: string | null;
}

interface GrupoMuestras {
  texto: string;
  abrTexto: string | null;
  cantidad: number;
}

function agruparEnPasos(puntos: PuntoMuestreo[]): PasoGuiaCalles[] {
  // 1) Agrupa las muestras consecutivas con el mismo nombre de vía, sin
  // filtrar todavía por longitud — esto es lo que hacía antes el único
  // paso de este algoritmo.
  const gruposCrudos: GrupoMuestras[] = [];
  for (const punto of puntos) {
    const texto = punto.via_texto ?? TEXTO_TRAMO_NO_IDENTIFICADO;
    const ultimo = gruposCrudos[gruposCrudos.length - 1];

    if (ultimo && ultimo.texto === texto) {
      ultimo.cantidad += 1;
      continue;
    }

    gruposCrudos.push({
      texto,
      abrTexto:
        texto === TEXTO_TRAMO_NO_IDENTIFICADO ? null : punto.via_abr_texto,
      cantidad: 1,
    });
  }

  // 2) Un grupo más corto que MIN_MUESTRAS_POR_PASO no cuenta como paso
  // propio: se fusiona con el grupo anterior (la ruta "sigue" en la vía
  // en la que ya iba, el cruce corto se ignora). Si es el primer grupo de
  // la ruta (no hay anterior con qué fusionar), se fusiona hacia adelante
  // con el siguiente en su lugar.
  const gruposFusionados: GrupoMuestras[] = [];
  for (const grupo of gruposCrudos) {
    const anterior = gruposFusionados[gruposFusionados.length - 1];
    if (grupo.cantidad < MIN_MUESTRAS_POR_PASO && anterior) {
      anterior.cantidad += grupo.cantidad;
      continue;
    }
    gruposFusionados.push({ ...grupo });
  }
  if (
    gruposFusionados.length > 1 &&
    gruposFusionados[0].cantidad < MIN_MUESTRAS_POR_PASO
  ) {
    const primero = gruposFusionados.shift()!;
    gruposFusionados[0].cantidad += primero.cantidad;
  }

  // 3) La fusión del paso 2 puede dejar dos grupos seguidos con el mismo
  // nombre (p. ej. A, B-corto, A vuelve a quedar A, A tras fusionar B en
  // el de atrás) — se colapsan en uno solo, igual que el criterio
  // original de "nunca repetir el mismo nombre en dos pasos seguidos".
  const pasosFinales: GrupoMuestras[] = [];
  for (const grupo of gruposFusionados) {
    const anterior = pasosFinales[pasosFinales.length - 1];
    if (anterior && anterior.texto === grupo.texto) {
      anterior.cantidad += grupo.cantidad;
      continue;
    }
    pasosFinales.push(grupo);
  }

  return pasosFinales.map((grupo, index) => ({
    orden: index,
    texto: grupo.texto,
    abrTexto: grupo.abrTexto,
  }));
}

export async function calcularYGuardarGuiaCallesMicrorruta(
  prisma: PrismaClient,
  microrrutaId: number,
): Promise<void> {
  const longitudRows = await prisma.$queryRaw<
    Array<{ longitud: number | null }>
  >`
    SELECT ST_Length(geom) AS longitud FROM microrrutas WHERE id = ${microrrutaId};
  `;
  const longitud = longitudRows[0]?.longitud ?? 0;

  if (!longitud || longitud <= 0) {
    await prisma.microrruta.update({
      where: { id: microrrutaId },
      data: { guiaCalles: [] },
    });
    return;
  }

  const numPuntos = Math.max(1, Math.ceil(longitud / INTERVALO_MUESTREO_M));

  const puntos = await prisma.$queryRaw<PuntoMuestreo[]>`
    SELECT
      gs.n AS punto_orden,
      via.texto AS via_texto,
      via.abr_texto AS via_abr_texto
    FROM microrrutas m
    CROSS JOIN generate_series(0, ${numPuntos}) AS gs(n)
    LEFT JOIN LATERAL (
      SELECT v.texto, v.abr_texto
      FROM vias v
      WHERE ST_DWithin(
        v.geom,
        ST_LineInterpolatePoint(m.geom, gs.n::float / ${numPuntos}),
        ${TOLERANCIA_VIA_M}
      )
      ORDER BY ST_Distance(
        v.geom,
        ST_LineInterpolatePoint(m.geom, gs.n::float / ${numPuntos})
      ) ASC
      LIMIT 1
    ) via ON true
    WHERE m.id = ${microrrutaId}
    ORDER BY gs.n;
  `;

  const guiaCalles = agruparEnPasos(puntos);

  await prisma.microrruta.update({
    where: { id: microrrutaId },
    data: { guiaCalles: guiaCalles as unknown as Prisma.InputJsonValue },
  });
}
