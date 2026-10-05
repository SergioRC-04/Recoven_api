-- AlterTable
-- Revierte la migración 20261004120000_add_afiliacion_doc: el documento
-- de afiliación deja de guardarse (ni en Supabase Storage ni en la BD) y
-- pasa a generarse al vuelo en cada descarga.
ALTER TABLE "recyclers" DROP COLUMN "afiliacion_doc_url";
ALTER TABLE "recyclers" DROP COLUMN "afiliacion_generada_en";
