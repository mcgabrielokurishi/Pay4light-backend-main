/*
  Warnings:

  - You are about to drop the `State` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `states` to the `Disco` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "State";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Disco" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tariffRate" REAL NOT NULL,
    "supportPhone" TEXT,
    "states" TEXT NOT NULL,
    "supportEmail" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Disco" ("code", "id", "isActive", "name", "supportEmail", "supportPhone", "tariffRate", "website") SELECT "code", "id", "isActive", "name", "supportEmail", "supportPhone", "tariffRate", "website" FROM "Disco";
DROP TABLE "Disco";
ALTER TABLE "new_Disco" RENAME TO "Disco";
CREATE UNIQUE INDEX "Disco_code_key" ON "Disco"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
