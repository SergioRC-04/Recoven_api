/*
  Warnings:

  - A unique constraint covering the columns `[identificador]` on the table `barrios` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "barrios_identificador_key" ON "barrios"("identificador");

-- AddForeignKey
ALTER TABLE "recycler_barrio" ADD CONSTRAINT "recycler_barrio_barrio_id_fkey" FOREIGN KEY ("barrio_id") REFERENCES "barrios"("identificador") ON DELETE CASCADE ON UPDATE CASCADE;
