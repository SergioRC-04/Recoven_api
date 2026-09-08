-- AlterTable
ALTER TABLE "microrrutas" ADD COLUMN     "localidad_dominante_cod" VARCHAR(10);

-- AlterTable
ALTER TABLE "recyclers" ALTER COLUMN "fecha_ingreso" SET DEFAULT '2026-01-01'::timestamp;

-- CreateTable
CREATE TABLE "macrorrutas" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(8),
    "localidad_cod" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "macrorrutas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "macrorrutas_numero_key" ON "macrorrutas"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "macrorrutas_localidad_cod_key" ON "macrorrutas"("localidad_cod");

-- AddForeignKey
ALTER TABLE "macrorrutas" ADD CONSTRAINT "macrorrutas_localidad_cod_fkey" FOREIGN KEY ("localidad_cod") REFERENCES "localidades"("identificador") ON DELETE RESTRICT ON UPDATE CASCADE;
