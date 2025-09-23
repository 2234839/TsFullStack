/*
  Warnings:

  - You are about to drop the `ApiCallLog` table and recreate it as `AiCallLog`.
  - All data will be preserved and copied to the new table.

*/

-- Disable foreign key constraints
PRAGMA foreign_keys=off;

-- Create new table with correct name
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
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("aiModelId") REFERENCES "AiModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Copy data from old table to new table
INSERT INTO "new_AiCallLog" ("id", "created", "updated", "clientIp", "userId", "aiModelId", "modelName", "inputTokens", "outputTokens", "success", "timestamp")
SELECT "id", "created", "updated", "clientIp", "userId", "aiModelId", "modelName", "inputTokens", "outputTokens", "success", "timestamp" FROM "ApiCallLog";

-- Drop old table
DROP TABLE "ApiCallLog";

-- Rename new table to final name
ALTER TABLE "new_AiCallLog" RENAME TO "AiCallLog";

-- Recreate indexes
CREATE INDEX "AiCallLog_clientIp_timestamp_idx" ON "AiCallLog"("clientIp", "timestamp");
CREATE INDEX "AiCallLog_userId_timestamp_idx" ON "AiCallLog"("userId", "timestamp");
CREATE INDEX "AiCallLog_aiModelId_timestamp_idx" ON "AiCallLog"("aiModelId", "timestamp");
CREATE INDEX "AiCallLog_modelName_timestamp_idx" ON "AiCallLog"("modelName", "timestamp");
CREATE INDEX "AiCallLog_userId_modelName_idx" ON "AiCallLog"("userId", "modelName");

-- Re-enable foreign key constraints
PRAGMA foreign_keys=on;