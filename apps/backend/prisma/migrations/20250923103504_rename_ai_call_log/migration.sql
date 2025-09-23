-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiCallLog" (
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
INSERT INTO "new_AiCallLog" ("aiModelId", "clientIp", "created", "id", "inputTokens", "modelName", "outputTokens", "success", "timestamp", "updated", "userId") SELECT "aiModelId", "clientIp", "created", "id", "inputTokens", "modelName", "outputTokens", "success", "timestamp", "updated", "userId" FROM "AiCallLog";
DROP TABLE "AiCallLog";
ALTER TABLE "new_AiCallLog" RENAME TO "AiCallLog";
CREATE INDEX "AiCallLog_clientIp_timestamp_idx" ON "AiCallLog"("clientIp", "timestamp");
CREATE INDEX "AiCallLog_userId_timestamp_idx" ON "AiCallLog"("userId", "timestamp");
CREATE INDEX "AiCallLog_aiModelId_timestamp_idx" ON "AiCallLog"("aiModelId", "timestamp");
CREATE INDEX "AiCallLog_modelName_timestamp_idx" ON "AiCallLog"("modelName", "timestamp");
CREATE INDEX "AiCallLog_userId_modelName_idx" ON "AiCallLog"("userId", "modelName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
