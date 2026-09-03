-- AlterTable
ALTER TABLE "recyclers" ALTER COLUMN "fecha_ingreso" SET DEFAULT '2026-01-01'::timestamp;

-- CreateTable
CREATE TABLE "microrruta_barrio" (
    "microrruta_id" INTEGER NOT NULL,
    "barrio_id" TEXT NOT NULL,

    CONSTRAINT "microrruta_barrio_pkey" PRIMARY KEY ("microrruta_id","barrio_id")
);

-- AddForeignKey
ALTER TABLE "microrruta_barrio" ADD CONSTRAINT "microrruta_barrio_microrruta_id_fkey" FOREIGN KEY ("microrruta_id") REFERENCES "microrrutas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microrruta_barrio" ADD CONSTRAINT "microrruta_barrio_barrio_id_fkey" FOREIGN KEY ("barrio_id") REFERENCES "barrios"("identificador") ON DELETE CASCADE ON UPDATE CASCADE;
