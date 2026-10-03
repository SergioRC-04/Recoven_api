-- CreateEnum
CREATE TYPE "ModalidadMicrorruta" AS ENUM ('A_PIE', 'CAMION');

-- AlterTable
ALTER TABLE "microrrutas" ADD COLUMN "modalidad" "ModalidadMicrorruta" NOT NULL DEFAULT 'A_PIE';
