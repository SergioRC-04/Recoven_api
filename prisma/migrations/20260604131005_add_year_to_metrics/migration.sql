-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Metric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sede" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 2026,
    "aprovechamiento" REAL NOT NULL,
    "rechazo" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Metric" ("aprovechamiento", "createdAt", "id", "mes", "rechazo", "sede", "updatedAt") SELECT "aprovechamiento", "createdAt", "id", "mes", "rechazo", "sede", "updatedAt" FROM "Metric";
DROP TABLE "Metric";
ALTER TABLE "new_Metric" RENAME TO "Metric";
CREATE UNIQUE INDEX "Metric_sede_mes_year_key" ON "Metric"("sede", "mes", "year");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
