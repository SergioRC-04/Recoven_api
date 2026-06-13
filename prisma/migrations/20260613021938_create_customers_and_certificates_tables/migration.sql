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
    "codigo_descarga" VARCHAR(30) NOT NULL,
    "empresa_id" UUID NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "archivo_url" VARCHAR(255) NOT NULL,
    "fecha_envio" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_clientes_nombre_key" ON "empresas_clientes"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_codigo_descarga_key" ON "certificados"("codigo_descarga");

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas_clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
