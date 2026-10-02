// src/microrrutas/utils/microrrutas-direcciones.util.ts
//
// Calcula y guarda en Microrruta.dirInicio/dirFin la dirección más cercana
// (tabla `direcciones`, ver prisma/seed-direcciones.ts) a cada extremo del
// trazo (ST_StartPoint/ST_EndPoint de la LineString). Mismo criterio de
// "vecino más cercano con tolerancia" que ya usa microrrutas-vias.util.ts
// para las vías: ST_DWithin(..., TOLERANCIA) + ORDER BY ST_Distance ASC
// LIMIT 1, dentro de un LEFT JOIN LATERAL — si no hay ninguna dirección
// dentro de la tolerancia, el campo queda en NULL en vez de forzar un
// valor inventado.
//
// Reglas (acordadas con el usuario):
// 1. No aplica a Puerto Colombia — la capa de direcciones solo cubre
//    Barranquilla (Direcciones_bq_magna); si la microrruta es de Puerto
//    Colombia, no se toca dirInicio/dirFin en absoluto.
// 2. Editar dirInicio/dirFin a mano (sin tocar el trazo) ya no pasa por
//    aquí — update() solo llama a esto cuando el DTO trae geojson (ver
//    microrrutas.service.ts), así que una edición de solo texto no
//    recalcula nada, se queda como se puso.
// 3. Redibujar el trazo COMPLETO (ambos extremos se mueven) recalcula
//    ambos campos, aunque alguno se hubiera corregido a mano antes.
// 4. Redibujar el trazo pero sin mover uno de los extremos conserva el
//    valor actual de ESE lado tal cual (manual o calculado, no importa
//    cuál), y solo recalcula el otro. Por eso updateGeom() debe pasar
//    `extremosAntes` (capturados ANTES del UPDATE que cambia geom) — sin
//    ellos (p. ej. al crear una ruta nueva) se calculan los dos.

import type { PrismaClient } from '@prisma/client';

// Tolerancia, en metros, para considerar que una dirección "pertenece" al
// extremo del trazo. Más amplia que TOLERANCIA_VIA_M (18m) porque un punto
// de dirección es la ubicación de un predio, no un punto sobre la vía
// misma donde corre la ruta — ajustable tras ver resultados reales.
export const TOLERANCIA_DIRECCION_M = 50;

// Tolerancia, en metros, para considerar que un extremo del trazo "no se
// movió" entre el antes y el después de una edición — no es una
// tolerancia de cercanía real (como la de arriba), es solo margen para
// ruido numérico de la reproyección; un ajuste intencional del trazo
// mueve el punto muchos metros, no centímetros.
const TOLERANCIA_MISMO_PUNTO_M = 0.5;

interface ExtremoDireccion {
  tipo: 'inicio' | 'fin';
  direccion: string | null;
}

export interface PuntoExtremo {
  x: number;
  y: number;
}

export interface ExtremosMicrorruta {
  inicio: PuntoExtremo | null;
  fin: PuntoExtremo | null;
}

function mismoPunto(a: PuntoExtremo | null, b: PuntoExtremo | null): boolean {
  if (!a || !b) return false;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy) <= TOLERANCIA_MISMO_PUNTO_M;
}

/**
 * Snapshot de los extremos actuales del trazo (en 9377, mismas unidades
 * que el geom) — se captura ANTES de actualizar la geometría, para poder
 * comparar después contra los extremos nuevos (ver regla 4).
 */
export async function obtenerExtremosMicrorruta(
  prisma: PrismaClient,
  microrrutaId: number,
): Promise<ExtremosMicrorruta> {
  const [fila] = await prisma.$queryRaw<
    Array<{
      inicioX: number | null;
      inicioY: number | null;
      finX: number | null;
      finY: number | null;
    }>
  >`
    SELECT
      ST_X(ST_StartPoint(geom)) AS "inicioX", ST_Y(ST_StartPoint(geom)) AS "inicioY",
      ST_X(ST_EndPoint(geom)) AS "finX", ST_Y(ST_EndPoint(geom)) AS "finY"
    FROM microrrutas
    WHERE id = ${microrrutaId};
  `;

  if (!fila) return { inicio: null, fin: null };
  return {
    inicio:
      fila.inicioX != null && fila.inicioY != null
        ? { x: fila.inicioX, y: fila.inicioY }
        : null,
    fin:
      fila.finX != null && fila.finY != null
        ? { x: fila.finX, y: fila.finY }
        : null,
  };
}

async function esDePuertoColombia(
  prisma: PrismaClient,
  microrrutaId: number,
): Promise<boolean> {
  const [fila] = await prisma.$queryRaw<Array<{ esPuertoColombia: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM microrruta_barrio mb
      JOIN barrios b ON b.identificador = mb.barrio_id
      JOIN localidades l ON l.identificador = b.localidad_cod
      WHERE mb.microrruta_id = ${microrrutaId} AND l.municipio = 'PUERTO_COLOMBIA'::"Municipio"
    ) AS "esPuertoColombia";
  `;
  return fila?.esPuertoColombia ?? false;
}

/**
 * @param extremosAntes Extremos del trazo ANTES de la edición (ver
 *   `obtenerExtremosMicrorruta`, capturado por el llamador antes de
 *   actualizar geom). Sin este parámetro (p. ej. al crear una microrruta
 *   nueva) se calculan siempre los dos extremos — no hay "antes" con qué
 *   comparar.
 */
export async function calcularYGuardarDireccionesMicrorruta(
  prisma: PrismaClient,
  microrrutaId: number,
  extremosAntes?: ExtremosMicrorruta,
): Promise<void> {
  if (await esDePuertoColombia(prisma, microrrutaId)) return;

  const extremosDespues = await obtenerExtremosMicrorruta(prisma, microrrutaId);

  const resultados = await prisma.$queryRaw<ExtremoDireccion[]>`
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
      WHERE ST_DWithin(d.geom, extremos.punto, ${TOLERANCIA_DIRECCION_M})
      ORDER BY ST_Distance(d.geom, extremos.punto) ASC
      LIMIT 1
    ) direccion_cercana ON true
    WHERE m.id = ${microrrutaId};
  `;

  const dirInicioCalculada =
    resultados.find((r) => r.tipo === 'inicio')?.direccion ?? null;
  const dirFinCalculada =
    resultados.find((r) => r.tipo === 'fin')?.direccion ?? null;

  // Sin extremosAntes (creación): siempre se calculan los dos. Con ellos
  // (edición de geometría): solo el lado cuyo extremo de verdad se movió.
  const data: { dirInicio?: string | null; dirFin?: string | null } = {};
  if (
    !extremosAntes ||
    !mismoPunto(extremosAntes.inicio, extremosDespues.inicio)
  ) {
    data.dirInicio = dirInicioCalculada;
  }
  if (!extremosAntes || !mismoPunto(extremosAntes.fin, extremosDespues.fin)) {
    data.dirFin = dirFinCalculada;
  }

  if (Object.keys(data).length > 0) {
    await prisma.microrruta.update({ where: { id: microrrutaId }, data });
  }
}
