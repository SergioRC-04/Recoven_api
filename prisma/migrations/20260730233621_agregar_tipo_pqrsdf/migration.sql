-- CreateEnum
CREATE TYPE "TipoPqrsdf" AS ENUM ('PETICION', 'QUEJA', 'RECLAMO', 'SUGERENCIA', 'DENUNCIA', 'FELICITACION');

-- CreateEnum
CREATE TYPE "EstadoPqrsdf" AS ENUM ('RECIBIDO', 'EN_TRAMITE', 'RESUELTO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "pqrsdf" (
    "id" TEXT NOT NULL,
    "radicado" TEXT NOT NULL,
    "tipo" "TipoPqrsdf" NOT NULL,
    "estado" "EstadoPqrsdf" NOT NULL DEFAULT 'RECIBIDO',
    "nombreCompleto" TEXT NOT NULL,
    "tipoIdentificacion" TEXT NOT NULL,
    "numeroIdentificacion" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "asunto" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "urlArchivo" TEXT,
    "respuesta" TEXT,
    "fechaRespuesta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pqrsdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pqrsdf_radicado_key" ON "pqrsdf"("radicado");

-- CreateIndex
CREATE INDEX "pqrsdf_radicado_idx" ON "pqrsdf"("radicado");

-- CreateIndex
CREATE INDEX "pqrsdf_numeroIdentificacion_idx" ON "pqrsdf"("numeroIdentificacion");
