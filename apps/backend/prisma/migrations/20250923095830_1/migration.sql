/*
  Warnings:

  - Added the required column `modelIdentifier` to the `ApiRateLimit` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ApiCallLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "clientIp" TEXT NOT NULL,
    "userId" TEXT,
    "aiModelId" INTEGER NOT NULL,
    "modelName" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApiRateLimit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "clientIp" TEXT NOT NULL,
    "userId" TEXT,
    "aiModelId" INTEGER NOT NULL,
    "modelIdentifier" TEXT NOT NULL,
    "tokenUsage" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ApiRateLimit" ("aiModelId", "clientIp", "created", "id", "timestamp", "updated", "userId") SELECT "aiModelId", "clientIp", "created", "id", "timestamp", "updated", "userId" FROM "ApiRateLimit";
DROP TABLE "ApiRateLimit";
ALTER TABLE "new_ApiRateLimit" RENAME TO "ApiRateLimit";
CREATE INDEX "ApiRateLimit_userId_modelIdentifier_idx" ON "ApiRateLimit"("userId", "modelIdentifier");
CREATE INDEX "ApiRateLimit_modelIdentifier_timestamp_idx" ON "ApiRateLimit"("modelIdentifier", "timestamp");
CREATE INDEX "ApiRateLimit_aiModelId_timestamp_idx" ON "ApiRateLimit"("aiModelId", "timestamp");
CREATE INDEX "ApiRateLimit_userId_timestamp_idx" ON "ApiRateLimit"("userId", "timestamp");
CREATE INDEX "ApiRateLimit_clientIp_timestamp_idx" ON "ApiRateLimit"("clientIp", "timestamp");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ApiCallLog_clientIp_timestamp_idx" ON "ApiCallLog"("clientIp", "timestamp");

-- CreateIndex
CREATE INDEX "ApiCallLog_userId_timestamp_idx" ON "ApiCallLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "ApiCallLog_aiModelId_timestamp_idx" ON "ApiCallLog"("aiModelId", "timestamp");

-- CreateIndex
CREATE INDEX "ApiCallLog_modelName_timestamp_idx" ON "ApiCallLog"("modelName", "timestamp");

-- CreateIndex
CREATE INDEX "ApiCallLog_userId_modelName_idx" ON "ApiCallLog"("userId", "modelName");
