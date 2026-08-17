-- AlterTable
ALTER TABLE "localidades" ALTER COLUMN "geom" TYPE geometry(MultiPolygon, 9377);
ALTER TABLE "barrios" ALTER COLUMN "geom" TYPE geometry(MultiPolygon, 9377);