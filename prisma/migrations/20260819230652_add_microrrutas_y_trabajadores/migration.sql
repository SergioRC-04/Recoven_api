-- CreateEnum
CREATE TYPE "EstadoVinculacion" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "ClasificacionTrabajador" AS ENUM ('NUEVO', 'REGULAR', 'A_QUITAR');

-- CreateEnum
CREATE TYPE "EstadoMicrorruta" AS ENUM ('BORRADOR', 'COMPLETO');

-- CreateTable
CREATE TABLE "trabajadores" (
    "id" SERIAL NOT NULL,
    "cedula" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "censado" BOOLEAN NOT NULL DEFAULT false,
    "estadoVinculacion" "EstadoVinculacion" NOT NULL DEFAULT 'ACTIVO',
    "clasificacion" "ClasificacionTrabajador" NOT NULL DEFAULT 'NUEVO',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trabajadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microrrutas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" INTEGER NOT NULL,
    "fecha_operacion" TIMESTAMP(3),
    "dir_inicio" TEXT,
    "hora_inicio" TEXT,
    "dir_fin" TEXT,
    "hora_fin" TEXT,
    "dist_pavimentada" DOUBLE PRECISION DEFAULT 0,
    "dist_no_pavimentada" DOUBLE PRECISION DEFAULT 0,
    "frecuencia" INTEGER,
    "dias_frecuencia" TEXT,
    "estacion_transferencia" INTEGER,
    "tipo_barrido" INTEGER,
    "estado" "EstadoMicrorruta" NOT NULL DEFAULT 'BORRADOR',
    "geom" geometry(LineString, 4326),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "microrrutas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trabajador_microrruta" (
    "trabajador_id" INTEGER NOT NULL,
    "microrruta_id" INTEGER NOT NULL,

    CONSTRAINT "trabajador_microrruta_pkey" PRIMARY KEY ("trabajador_id","microrruta_id")
);

-- CreateTable
CREATE TABLE "trabajador_barrio" (
    "trabajador_id" INTEGER NOT NULL,
    "barrio_id" TEXT NOT NULL,

    CONSTRAINT "trabajador_barrio_pkey" PRIMARY KEY ("trabajador_id","barrio_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trabajadores_cedula_key" ON "trabajadores"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "microrrutas_nombre_key" ON "microrrutas"("nombre");

-- AddForeignKey
ALTER TABLE "trabajador_microrruta" ADD CONSTRAINT "trabajador_microrruta_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajador_microrruta" ADD CONSTRAINT "trabajador_microrruta_microrruta_id_fkey" FOREIGN KEY ("microrruta_id") REFERENCES "microrrutas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajador_barrio" ADD CONSTRAINT "trabajador_barrio_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
