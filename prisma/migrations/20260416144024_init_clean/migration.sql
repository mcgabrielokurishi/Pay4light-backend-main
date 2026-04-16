/*
  Warnings:

  - You are about to alter the column `units` on the `ElectricityPurchase` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.
  - You are about to alter the column `balance` on the `LedgerAccount` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.
  - You are about to alter the column `amount` on the `LedgerEntry` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.
  - You are about to alter the column `balanceAfter` on the `LedgerEntry` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.
  - You are about to alter the column `balanceBefore` on the `LedgerEntry` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.
  - You are about to alter the column `amount` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.
  - You are about to drop the column `lockedUntill` on the `User` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `VendorTransaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.
  - You are about to alter the column `amount` on the `Wallet` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.
  - You are about to alter the column `balance` on the `Wallet` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ElectricityPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "disco" TEXT NOT NULL,
    "meterNumber" TEXT NOT NULL,
    "meterType" TEXT NOT NULL,
    "units" REAL,
    "token" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ElectricityPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElectricityPurchase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ElectricityPurchase" ("createdAt", "disco", "id", "meterNumber", "meterType", "status", "token", "transactionId", "units", "userId") SELECT "createdAt", "disco", "id", "meterNumber", "meterType", "status", "token", "transactionId", "units", "userId" FROM "ElectricityPurchase";
DROP TABLE "ElectricityPurchase";
ALTER TABLE "new_ElectricityPurchase" RENAME TO "ElectricityPurchase";
CREATE UNIQUE INDEX "ElectricityPurchase_transactionId_key" ON "ElectricityPurchase"("transactionId");
CREATE TABLE "new_LedgerAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "balance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_LedgerAccount" ("accountId", "balance", "createdAt", "id", "name", "type", "userId") SELECT "accountId", "balance", "createdAt", "id", "name", "type", "userId" FROM "LedgerAccount";
DROP TABLE "LedgerAccount";
ALTER TABLE "new_LedgerAccount" RENAME TO "LedgerAccount";
CREATE TABLE "new_LedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "balanceBefore" REAL NOT NULL DEFAULT 0,
    "balanceAfter" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LedgerEntry" ("accountId", "amount", "balanceAfter", "balanceBefore", "createdAt", "description", "id", "metadata", "transactionId", "type", "walletId") SELECT "accountId", "amount", "balanceAfter", "balanceBefore", "createdAt", "description", "id", "metadata", "transactionId", "type", "walletId" FROM "LedgerEntry";
DROP TABLE "LedgerEntry";
ALTER TABLE "new_LedgerEntry" RENAME TO "LedgerEntry";
CREATE TABLE "new_LedgerTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "description" TEXT,
    "walletId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_LedgerTransaction" ("createdAt", "description", "id", "reference", "status", "transactionId", "walletId") SELECT "createdAt", "description", "id", "reference", "status", "transactionId", "walletId" FROM "LedgerTransaction";
DROP TABLE "LedgerTransaction";
ALTER TABLE "new_LedgerTransaction" RENAME TO "LedgerTransaction";
CREATE UNIQUE INDEX "LedgerTransaction_reference_key" ON "LedgerTransaction"("reference");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "meterId" TEXT,
    "metadata" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "token" TEXT,
    "amount" REAL NOT NULL,
    "kwh" REAL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "createdAt", "description", "id", "kwh", "metadata", "meterId", "reference", "status", "token", "type", "userId", "walletId") SELECT "amount", "createdAt", "description", "id", "kwh", "metadata", "meterId", "reference", "status", "token", "type", "userId", "walletId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "discoId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_discoId_fkey" FOREIGN KEY ("discoId") REFERENCES "Disco" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "discoId", "email", "failedAttempts", "firstName", "fullName", "id", "isVerified", "lastName", "password", "phone", "role", "updatedAt") SELECT "createdAt", "discoId", "email", "failedAttempts", "firstName", "fullName", "id", "isVerified", "lastName", "password", "phone", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE TABLE "new_VendorTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "token" TEXT,
    "meterID" TEXT,
    "units" TEXT,
    "amount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "requestPayload" TEXT NOT NULL,
    "responsePayload" TEXT,
    "externalRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VendorTransaction" ("amount", "createdAt", "externalRef", "id", "meterID", "provider", "reference", "requestPayload", "responsePayload", "serviceType", "status", "token", "units", "updatedAt", "userId") SELECT "amount", "createdAt", "externalRef", "id", "meterID", "provider", "reference", "requestPayload", "responsePayload", "serviceType", "status", "token", "units", "updatedAt", "userId" FROM "VendorTransaction";
DROP TABLE "VendorTransaction";
ALTER TABLE "new_VendorTransaction" RENAME TO "VendorTransaction";
CREATE UNIQUE INDEX "VendorTransaction_reference_key" ON "VendorTransaction"("reference");
CREATE TABLE "new_Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "balance" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "virtualAccountNuban" TEXT,
    "virtual_account_bank" TEXT,
    "virtual_account_ref" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Wallet" ("amount", "balance", "createdAt", "currency", "id", "locked", "updatedAt", "userId", "virtualAccountNuban", "virtual_account_bank", "virtual_account_ref") SELECT "amount", "balance", "createdAt", "currency", "id", "locked", "updatedAt", "userId", "virtualAccountNuban", "virtual_account_bank", "virtual_account_ref" FROM "Wallet";
DROP TABLE "Wallet";
ALTER TABLE "new_Wallet" RENAME TO "Wallet";
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
