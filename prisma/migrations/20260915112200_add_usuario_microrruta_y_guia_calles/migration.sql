-- AlterTable
ALTER TABLE "microrrutas" ADD COLUMN     "guia_calles" JSONB;

-- AlterTable
ALTER TABLE "recyclers" ALTER COLUMN "fecha_ingreso" SET DEFAULT '2026-01-01'::timestamp;

-- CreateTable
CREATE TABLE "usuarios_microrruta" (
    "id" SERIAL NOT NULL,
    "direccion" TEXT NOT NULL,
    "poliza" TEXT NOT NULL,
    "detalles" VARCHAR(500) NOT NULL,
    "microrruta_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_microrruta_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "usuarios_microrruta" ADD CONSTRAINT "usuarios_microrruta_microrruta_id_fkey" FOREIGN KEY ("microrruta_id") REFERENCES "microrrutas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
