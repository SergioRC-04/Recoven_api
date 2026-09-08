/*
  Warnings:

  - You are about to drop the column `localidad_dominante_cod` on the `microrrutas` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "microrrutas" DROP COLUMN "localidad_dominante_cod",
ADD COLUMN     "macrorruta_id" INTEGER;

-- AlterTable
ALTER TABLE "recyclers" ALTER COLUMN "fecha_ingreso" SET DEFAULT '2026-01-01'::timestamp;

-- AddForeignKey
ALTER TABLE "microrrutas" ADD CONSTRAINT "microrrutas_macrorruta_id_fkey" FOREIGN KEY ("macrorruta_id") REFERENCES "macrorrutas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
