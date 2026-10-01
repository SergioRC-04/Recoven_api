// src/recyclers/utils/recycler-barrios-sync.util.ts
//
// El barrio de un reciclador deja de ser un dato manual independiente en
// cuanto tiene al menos una microrruta asignada: se toma (y se mantiene
// sincronizado) del barrio real de esa(s) ruta(s), calculado
// geográficamente (ver microrrutas-barrios.util.ts). Solo un reciclador
// SIN ninguna microrruta sigue teniendo un barrio manual, editable a mano.
//
// Reglas completas (acordadas con el usuario):
// 1. Se edita una microrruta y cambia de barrio → se actualiza el barrio
//    de los recicladores que la tengan asignada (sincronizarBarriosRecicladoresDeMicrorruta,
//    llamado desde calcularYGuardarBarriosMicrorruta).
// 2. Se elimina una microrruta → el barrio del reciclador NO se toca (no
//    hay ninguna función de este archivo involucrada en el borrado).
// 3/4. Se crea un reciclador con/sin microrruta → sincronizarBarrioReciclador.
// 5. Se le cambian las microrrutas a un reciclador (incluido quitárselas
//    todas) → sincronizarBarrioReciclador; si queda sin ninguna, el barrio
//    anterior se deja tal cual (vuelve a ser editable a mano).
// 6/7. Se edita solo el barrio, o cualquier otro campo → sin cambios aquí
//    (lo decide el llamador: solo invoca esto si tocó barrios o rutas).
//
// Todas las funciones reciben el PrismaClient o Prisma.TransactionClient ya
// activo del llamador — nunca abren su propia conexión ni transacción
// nueva, para poder correr dentro de la transacción de quien las use.

import type { PrismaClient, Prisma } from '@prisma/client';

type Cliente = PrismaClient | Prisma.TransactionClient;

/**
 * Unión (sin repetir) de los barrios por los que pasan las microrrutas
 * dadas — si un reciclador tiene varias rutas en barrios distintos, queda
 * con todos. Vacío si `microrrutaIds` está vacío.
 */
export async function obtenerBarriosDeMicrorrutas(
  prisma: Cliente,
  microrrutaIds: number[],
): Promise<string[]> {
  if (microrrutaIds.length === 0) return [];

  const filas = await prisma.microrrutaBarrio.findMany({
    where: { microrrutaId: { in: microrrutaIds } },
    select: { barrioId: true },
    distinct: ['barrioId'],
  });
  return filas.map((f) => f.barrioId);
}

/**
 * Reescribe RecyclerBarrio para un reciclador según su situación actual:
 * - con rutas (`microrrutaIdsFinal.length > 0`): se derivan del barrio de
 *   esas rutas, ignorando `barriosIdsManual` aunque venga informado (el
 *   formulario no manda sobre el barrio mientras haya ruta).
 * - sin rutas y con `barriosIdsManual` informado (!== undefined): se
 *   guarda tal cual, como el flujo manual de siempre.
 * - sin rutas y sin `barriosIdsManual`: no se toca nada (el barrio que
 *   tuviera antes —p. ej. porque se le acaban de quitar todas las rutas—
 *   queda igual, ahora editable a mano).
 */
export async function sincronizarBarrioReciclador(
  tx: Cliente,
  recyclerId: number,
  microrrutaIdsFinal: number[],
  barriosIdsManual: string[] | undefined,
): Promise<void> {
  let barriosAGuardar: string[] | undefined;

  if (microrrutaIdsFinal.length > 0) {
    barriosAGuardar = await obtenerBarriosDeMicrorrutas(tx, microrrutaIdsFinal);
  } else if (barriosIdsManual !== undefined) {
    barriosAGuardar = barriosIdsManual;
  }

  if (barriosAGuardar === undefined) return;

  await tx.recyclerBarrio.deleteMany({ where: { recyclerId } });
  if (barriosAGuardar.length > 0) {
    await tx.recyclerBarrio.createMany({
      data: barriosAGuardar.map((barrioId) => ({ recyclerId, barrioId })),
    });
  }
}

/**
 * Se llama cuando el barrio de UNA microrruta cambió (recalculado
 * geográficamente): recalcula el barrio de cada reciclador que la tenga
 * asignada, considerando TODAS sus rutas (no solo esta), por si tiene más
 * de una en barrios distintos.
 */
export async function sincronizarBarriosRecicladoresDeMicrorruta(
  prisma: PrismaClient,
  microrrutaId: number,
): Promise<void> {
  const asignados = await prisma.recyclerMicrorruta.findMany({
    where: { microrrutaId },
    select: { recyclerId: true },
  });

  for (const { recyclerId } of asignados) {
    const rutas = await prisma.recyclerMicrorruta.findMany({
      where: { recyclerId },
      select: { microrrutaId: true },
    });
    await sincronizarBarrioReciclador(
      prisma,
      recyclerId,
      rutas.map((r) => r.microrrutaId),
      undefined,
    );
  }
}
