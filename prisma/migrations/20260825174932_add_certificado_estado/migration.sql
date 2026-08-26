-- CreateEnum
CREATE TYPE "EstadoCertificado" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO');

-- AlterTable
ALTER TABLE "certificados" ADD COLUMN     "error_detalle" TEXT,
ADD COLUMN     "estado" "EstadoCertificado" NOT NULL DEFAULT 'PENDIENTE';

-- AlterTable
ALTER TABLE "recyclers" ALTER COLUMN "fecha_ingreso" SET DEFAULT '2026-01-01'::timestamp;
