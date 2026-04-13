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
    CONSTRAINT "Meter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Meter" ("address", "createdAt", "discoId", "id", "isDefault", "meterNumber", "meterType", "userId") SELECT "address", "createdAt", "discoId", "id", "isDefault", "meterNumber", "meterType", "userId" FROM "Meter";
DROP TABLE "Meter";
ALTER TABLE "new_Meter" RENAME TO "Meter";
CREATE UNIQUE INDEX "Meter_meterNumber_key" ON "Meter"("meterNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
