-- Historial de cierres de censo de recicladores (uno por ciudad).
CREATE TABLE "cierres_censo" (
    "id" SERIAL NOT NULL,
    "municipio" "Municipio" NOT NULL,
    "fecha_cierre" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desvinculados" INTEGER NOT NULL,
    "nuevos_a_regulares" INTEGER NOT NULL,
    "censados_antes" INTEGER NOT NULL,
    "censados_despues" INTEGER NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "url_archivo" VARCHAR(500) NOT NULL,

    CONSTRAINT "cierres_censo_pkey" PRIMARY KEY ("id")
);
