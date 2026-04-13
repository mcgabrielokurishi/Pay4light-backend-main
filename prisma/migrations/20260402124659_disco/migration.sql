/*
  Warnings:

  - You are about to drop the column `disco` on the `Meter` table. All the data in the column will be lost.
  - Added the required column `discoId` to the `Meter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `meterId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "State" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "discoId" TEXT NOT NULL,
    CONSTRAINT "State_discoId_fkey" FOREIGN KEY ("discoId") REFERENCES "Disco" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Disco" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tariffRate" REAL NOT NULL,
    "supportPhone" TEXT,
    "supportEmail" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "meterNumber" TEXT NOT NULL,
    "meterType" TEXT NOT NULL,
    "discoId" TEXT NOT NULL,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Meter_discoId_fkey" FOREIGN KEY ("discoId") REFERENCES "Disco" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Meter" ("createdAt", "id", "meterNumber", "meterType", "userId") SELECT "createdAt", "id", "meterNumber", "meterType", "userId" FROM "Meter";
DROP TABLE "Meter";
ALTER TABLE "new_Meter" RENAME TO "Meter";
CREATE UNIQUE INDEX "Meter_meterNumber_key" ON "Meter"("meterNumber");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "token" TEXT,
    "amount" DECIMAL NOT NULL,
    "kwh" REAL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "createdAt", "description", "id", "kwh", "metadata", "reference", "status", "type", "userId", "walletId") SELECT "amount", "createdAt", "description", "id", "kwh", "metadata", "reference", "status", "type", "userId", "walletId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Disco_code_key" ON "Disco"("code");
