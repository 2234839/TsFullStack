-- CreateTable
CREATE TABLE "DiagTrace" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "method" TEXT NOT NULL,
    "totalMs" INTEGER NOT NULL,
    "queueWaitMs" INTEGER NOT NULL,
    "authMs" INTEGER,
    "sqlCount" INTEGER NOT NULL DEFAULT 0,
    "sqlTotalMs" INTEGER NOT NULL DEFAULT 0,
    "sqlMaxMs" INTEGER NOT NULL DEFAULT 0,
    "loopLagMaxMs" INTEGER NOT NULL DEFAULT 0,
    "timeline" JSONB
);

-- CreateIndex
CREATE INDEX "DiagTrace_created_idx" ON "DiagTrace"("created");

-- CreateIndex
CREATE INDEX "DiagTrace_totalMs_idx" ON "DiagTrace"("totalMs");
