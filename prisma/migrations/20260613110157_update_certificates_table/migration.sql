/*
  Warnings:

  - You are about to drop the column `archivo_url` on the `certificados` table. All the data in the column will be lost.
  - You are about to drop the column `codigo_descarga` on the `certificados` table. All the data in the column will be lost.
  - Added the required column `nombre_archivo` to the `certificados` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "certificados_codigo_descarga_key";

-- AlterTable
ALTER TABLE "certificados" DROP COLUMN "archivo_url",
DROP COLUMN "codigo_descarga",
ADD COLUMN     "nombre_archivo" VARCHAR(255) NOT NULL;
