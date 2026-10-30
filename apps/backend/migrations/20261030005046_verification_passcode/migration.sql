-- CreateTable
CREATE TABLE "VerificationPasscode" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "ticket" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "channelIdentity" TEXT,
    "payload" JSONB,
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "consumedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationPasscode_ticket_key" ON "VerificationPasscode"("ticket");

-- CreateIndex
CREATE INDEX "VerificationPasscode_status_expiresAt_idx" ON "VerificationPasscode"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationPasscode_channel_code_key" ON "VerificationPasscode"("channel", "code");
