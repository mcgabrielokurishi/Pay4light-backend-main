-- AlterTable
ALTER TABLE "Meter" ADD COLUMN "meterName" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "meterId" TEXT,
    "metadata" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "token" TEXT,
    "amount" DECIMAL NOT NULL,
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
    "lockedUntill" DATETIME,
    "discoId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_discoId_fkey" FOREIGN KEY ("discoId") REFERENCES "Disco" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "failedAttempts", "firstName", "fullName", "id", "isVerified", "lastName", "lockedUntill", "password", "phone", "role", "updatedAt") SELECT "createdAt", "email", "failedAttempts", "firstName", "fullName", "id", "isVerified", "lastName", "lockedUntill", "password", "phone", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
