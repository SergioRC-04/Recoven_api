// src/recyclers/utils/microrruta-fecha-sync.util.ts
//
// La fecha de operación de una microrruta se deriva de la fecha de
// ingreso de sus recicladores en cuanto tiene al menos uno asignado: se
// toma la más antigua entre todos (si tiene varios). Mismo patrón que
// recycler-barrios-sync.util.ts, pero en sentido inverso — ahí el dato
// baja de Microrruta a Recycler (el barrio); aquí sube de Recycler a
// Microrruta (la fecha).
//
// Reglas (acordadas con el usuario):
// 1. Al crear una microrruta con un reciclador elegido de entrada, el
//    formulario solo la PRECARGA (ver AdminMicrorrutas.tsx/
//    MicrorrutaFormModal.tsx) — quien realmente fija el valor guardado es
//    la asignación real que ocurre justo después (asignarMicrorruta),
//    que pasa por esta misma función.
// 2. Cualquier cambio de a qué microrruta(s) está asignado un reciclador
//    (se le agrega una, se le quita, se reemplaza su lista completa)
//    recalcula la fecha de las microrrutas afectadas = la fechaIngreso
//    más antigua entre los recicladores que les queden asignados. Si una
//    queda sin ninguno, su fechaOperacion NO se toca (queda como estaba).
// 3. Editar una microrruta desde su propio formulario, sin tocar nada de
//    aquí (microrrutas.service.ts update() no llama a esta función).

import type { PrismaClient, Prisma } from '@prisma/client';

type Cliente = PrismaClient | Prisma.TransactionClient;

export async function sincronizarFechaOperacionMicrorrutas(
  tx: Cliente,
  microrrutaIds: number[],
): Promise<void> {
  for (const microrrutaId of microrrutaIds) {
    const asignados = await tx.recyclerMicrorruta.findMany({
      where: { microrrutaId },
      select: { recycler: { select: { fechaIngreso: true } } },
    });

    if (asignados.length === 0) continue;

    const fechaMasAntigua = asignados.reduce(
      (minima, a) =>
        a.recycler.fechaIngreso < minima ? a.recycler.fechaIngreso : minima,
      asignados[0].recycler.fechaIngreso,
    );

    await tx.microrruta.update({
      where: { id: microrrutaId },
      data: { fechaOperacion: fechaMasAntigua },
    });
  }
}
