/*
  Warnings:

  - Added the required column `walletId` to the `LedgerTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LedgerTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "description" TEXT,
    "walletId" TEXT NOT NULL,
    "transactionId" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_LedgerTransaction" ("createdAt", "description", "id", "reference", "status", "transactionId") SELECT "createdAt", "description", "id", "reference", "status", "transactionId" FROM "LedgerTransaction";
DROP TABLE "LedgerTransaction";
ALTER TABLE "new_LedgerTransaction" RENAME TO "LedgerTransaction";
CREATE UNIQUE INDEX "LedgerTransaction_reference_key" ON "LedgerTransaction"("reference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
