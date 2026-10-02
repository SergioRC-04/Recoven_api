-- CreateTable
CREATE TABLE "direcciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "global_id" VARCHAR(50) NOT NULL,
    "direccion" VARCHAR(150) NOT NULL,
    "sector_ciudad" VARCHAR(150),
    "geom" geometry(Point, 9377),

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "direcciones_global_id_key" ON "direcciones"("global_id");

-- CreateIndex
CREATE INDEX "direcciones_geom_idx" ON "direcciones" USING GIST ("geom");
