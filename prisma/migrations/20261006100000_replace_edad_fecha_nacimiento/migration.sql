-- AlterTable
-- "edad" se guardaba fijo y quedaba desactualizado cada año. Se reemplaza
-- por la fecha de nacimiento (que no cambia); la edad se calcula al
-- vuelo al generar el Excel (ver recyclers-export.util.ts).
ALTER TABLE "recyclers" DROP COLUMN "edad";
ALTER TABLE "recyclers" ADD COLUMN "fecha_nacimiento" TIMESTAMP(3);
