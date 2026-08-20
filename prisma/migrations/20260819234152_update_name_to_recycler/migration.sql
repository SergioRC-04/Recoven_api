/*
  Warnings:

  - You are about to drop the `trabajador_barrio` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `trabajador_microrruta` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `trabajadores` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ClasificacionRecycler" AS ENUM ('NUEVO', 'REGULAR', 'A_QUITAR');

-- DropForeignKey
ALTER TABLE "trabajador_barrio" DROP CONSTRAINT "trabajador_barrio_trabajador_id_fkey";

-- DropForeignKey
ALTER TABLE "trabajador_microrruta" DROP CONSTRAINT "trabajador_microrruta_microrruta_id_fkey";

-- DropForeignKey
ALTER TABLE "trabajador_microrruta" DROP CONSTRAINT "trabajador_microrruta_trabajador_id_fkey";

-- DropTable
DROP TABLE "trabajador_barrio";

-- DropTable
DROP TABLE "trabajador_microrruta";

-- DropTable
DROP TABLE "trabajadores";

-- DropEnum
DROP TYPE "ClasificacionTrabajador";

-- CreateTable
CREATE TABLE "recyclers" (
    "id" SERIAL NOT NULL,
    "cedula" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "censado" BOOLEAN NOT NULL DEFAULT false,
    "estadoVinculacion" "EstadoVinculacion" NOT NULL DEFAULT 'ACTIVO',
    "clasificacion" "ClasificacionRecycler" NOT NULL DEFAULT 'NUEVO',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recyclers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recycler_microrruta" (
    "recycler_id" INTEGER NOT NULL,
    "microrruta_id" INTEGER NOT NULL,

    CONSTRAINT "recycler_microrruta_pkey" PRIMARY KEY ("recycler_id","microrruta_id")
);

-- CreateTable
CREATE TABLE "recycler_barrio" (
    "recycler_id" INTEGER NOT NULL,
    "barrio_id" TEXT NOT NULL,

    CONSTRAINT "recycler_barrio_pkey" PRIMARY KEY ("recycler_id","barrio_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recyclers_cedula_key" ON "recyclers"("cedula");

-- AddForeignKey
ALTER TABLE "recycler_microrruta" ADD CONSTRAINT "recycler_microrruta_recycler_id_fkey" FOREIGN KEY ("recycler_id") REFERENCES "recyclers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recycler_microrruta" ADD CONSTRAINT "recycler_microrruta_microrruta_id_fkey" FOREIGN KEY ("microrruta_id") REFERENCES "microrrutas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recycler_barrio" ADD CONSTRAINT "recycler_barrio_recycler_id_fkey" FOREIGN KEY ("recycler_id") REFERENCES "recyclers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
