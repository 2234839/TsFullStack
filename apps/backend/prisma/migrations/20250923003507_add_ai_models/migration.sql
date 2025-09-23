-- CreateTable
CREATE TABLE "AiModel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 100,
    "rpmLimit" INTEGER NOT NULL DEFAULT 60,
    "rphLimit" INTEGER NOT NULL DEFAULT 1000,
    "rpdLimit" INTEGER NOT NULL DEFAULT 10000,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "ApiRateLimit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "clientIp" TEXT NOT NULL,
    "userId" TEXT,
    "aiModelId" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ApiRateLimit_clientIp_timestamp_idx" ON "ApiRateLimit"("clientIp", "timestamp");

-- CreateIndex
CREATE INDEX "ApiRateLimit_userId_timestamp_idx" ON "ApiRateLimit"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "ApiRateLimit_aiModelId_timestamp_idx" ON "ApiRateLimit"("aiModelId", "timestamp");
