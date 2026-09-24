-- Teléfono del reciclador. Nullable: los registros existentes no lo tienen;
-- la obligatoriedad se exige en el DTO de creación y el formulario.
ALTER TABLE "recyclers" ADD COLUMN "telefono" VARCHAR(20);
