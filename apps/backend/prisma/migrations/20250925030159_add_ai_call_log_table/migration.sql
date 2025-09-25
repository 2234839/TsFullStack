/*
  Warnings:

  - You are about to drop the `ApiCallLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ApiCallLog";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "AiCallLog" (
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

-- CreateIndex
CREATE INDEX "AiCallLog_clientIp_timestamp_idx" ON "AiCallLog"("clientIp", "timestamp");

-- CreateIndex
CREATE INDEX "AiCallLog_userId_timestamp_idx" ON "AiCallLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AiCallLog_aiModelId_timestamp_idx" ON "AiCallLog"("aiModelId", "timestamp");

-- CreateIndex
CREATE INDEX "AiCallLog_modelName_timestamp_idx" ON "AiCallLog"("modelName", "timestamp");

-- CreateIndex
CREATE INDEX "AiCallLog_userId_modelName_idx" ON "AiCallLog"("userId", "modelName");
