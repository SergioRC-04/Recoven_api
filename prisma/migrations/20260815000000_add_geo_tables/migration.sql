-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "TipoPqrsdf" AS ENUM ('PETICION', 'QUEJA', 'RECLAMO', 'SUGERENCIA', 'DENUNCIA', 'FELICITACION');

-- CreateEnum
CREATE TYPE "EstadoPqrsdf" AS ENUM ('RECIBIDO', 'EN_TRAMITE', 'RESUELTO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "Metric" (
    "id" SERIAL NOT NULL,
    "sede" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "aprovechamiento" DOUBLE PRECISION NOT NULL,
    "rechazo" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "twoFactorCode" TEXT,
    "twoFactorExpires" TIMESTAMP(3),

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "empresa" TEXT,
    "direccion" TEXT,
    "servicio" TEXT NOT NULL,
    "especialidad" TEXT,
    "mensaje" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas_clientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(150) NOT NULL,
    "correo" VARCHAR(100) NOT NULL,
    "fecha_creacion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "nombre_archivo" VARCHAR(255) NOT NULL,
    "url_archivo" VARCHAR(255),
    "fecha_envio" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificados_pkey" PRIMARY KEY ("id")
);

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
    "urlRespuesta" TEXT,
    "fechaRespuesta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pqrsdf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localidades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "object_id" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "identificador" VARCHAR(10) NOT NULL,
    "st_area_shape" DOUBLE PRECISION,
    "geom" geometry(Polygon, 9377),

    CONSTRAINT "localidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barrios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "object_id" INTEGER NOT NULL,
    "identificador" VARCHAR(20) NOT NULL,
    "nombre_barrio" VARCHAR(150) NOT NULL,
    "nombre_pieza" INTEGER,
    "localidad_cod" VARCHAR(10) NOT NULL,
    "observaciones" VARCHAR(100),
    "st_area_shape" DOUBLE PRECISION,
    "geom" geometry(Polygon, 9377),

    CONSTRAINT "barrios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "object_id" INTEGER NOT NULL,
    "texto" VARCHAR(100),
    "abr_texto" VARCHAR(50),
    "shape_len" DOUBLE PRECISION,
    "geom" geometry(MultiLineString, 9377),

    CONSTRAINT "vias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Metric_sede_mes_year_key" ON "Metric"("sede", "mes", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_clientes_nombre_key" ON "empresas_clientes"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "pqrsdf_radicado_key" ON "pqrsdf"("radicado");

-- CreateIndex
CREATE INDEX "pqrsdf_radicado_idx" ON "pqrsdf"("radicado");

-- CreateIndex
CREATE INDEX "pqrsdf_numeroIdentificacion_idx" ON "pqrsdf"("numeroIdentificacion");

-- CreateIndex
CREATE UNIQUE INDEX "localidades_identificador_key" ON "localidades"("identificador");

-- CreateIndex
CREATE INDEX "localidades_geom_idx" ON "localidades" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "barrios_geom_idx" ON "barrios" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "vias_geom_idx" ON "vias" USING GIST ("geom");

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas_clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barrios" ADD CONSTRAINT "barrios_localidad_cod_fkey" FOREIGN KEY ("localidad_cod") REFERENCES "localidades"("identificador") ON DELETE RESTRICT ON UPDATE CASCADE;
