-- CreateEnum
CREATE TYPE "Municipio" AS ENUM ('BARRANQUILLA', 'PUERTO_COLOMBIA');

-- AlterTable
ALTER TABLE "localidades" ADD COLUMN     "municipio" "Municipio" NOT NULL DEFAULT 'BARRANQUILLA';

-- AlterTable
ALTER TABLE "recyclers" ALTER COLUMN "fecha_ingreso" SET DEFAULT '2026-01-01'::timestamp;
