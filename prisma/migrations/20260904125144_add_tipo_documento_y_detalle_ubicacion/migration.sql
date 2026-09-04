/*
  Warnings:

  - A unique constraint covering the columns `[tipo_documento,cedula]` on the table `recyclers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'CEDULA_VENEZOLANA', 'PASAPORTE', 'OTRO');

-- DropIndex
DROP INDEX "recyclers_cedula_key";

-- AlterTable
ALTER TABLE "recyclers" ADD COLUMN     "detalle_ubicacion" VARCHAR(255),
ADD COLUMN     "tipo_documento" "TipoDocumento" NOT NULL DEFAULT 'CEDULA_CIUDADANIA',
ALTER COLUMN "fecha_ingreso" SET DEFAULT '2026-01-01'::timestamp;

-- CreateIndex
CREATE UNIQUE INDEX "recyclers_tipo_documento_cedula_key" ON "recyclers"("tipo_documento", "cedula");
