-- Alterar el SRID de la columna geom a 9377
ALTER TABLE "microrrutas" 
  ALTER COLUMN "geom" TYPE geometry(LineString, 9377) 
  USING ST_Transform(geom, 9377);