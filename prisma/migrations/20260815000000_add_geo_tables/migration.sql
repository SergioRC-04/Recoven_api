-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

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
CREATE UNIQUE INDEX "localidades_identificador_key" ON "localidades"("identificador");

-- CreateIndex
CREATE INDEX "localidades_geom_idx" ON "localidades" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "barrios_geom_idx" ON "barrios" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "vias_geom_idx" ON "vias" USING GIST ("geom");

-- AddForeignKey
ALTER TABLE "barrios" ADD CONSTRAINT "barrios_localidad_cod_fkey" FOREIGN KEY ("localidad_cod") REFERENCES "localidades"("identificador") ON DELETE RESTRICT ON UPDATE CASCADE;