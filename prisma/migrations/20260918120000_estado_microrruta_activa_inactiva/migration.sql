-- El estado de la microrruta pasa de BORRADOR/COMPLETO (nunca se usó) a
-- ACTIVA/INACTIVA. RENAME VALUE conserva los datos: todas las filas que hoy
-- son BORRADOR quedan como ACTIVA.
ALTER TYPE "EstadoMicrorruta" RENAME VALUE 'BORRADOR' TO 'ACTIVA';
ALTER TYPE "EstadoMicrorruta" RENAME VALUE 'COMPLETO' TO 'INACTIVA';
ALTER TABLE "microrrutas" ALTER COLUMN "estado" SET DEFAULT 'ACTIVA';
