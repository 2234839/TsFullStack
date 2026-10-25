-- CreateTable
CREATE TABLE "GroupQRCode" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entry" TEXT NOT NULL,
    "groupName" TEXT,
    "imagePath" TEXT NOT NULL,
    "imageSize" INTEGER NOT NULL,
    "imageMime" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT
);

-- CreateIndex
CREATE INDEX "GroupQRCode_entry_status_idx" ON "GroupQRCode"("entry", "status");

-- CreateIndex
CREATE INDEX "GroupQRCode_entry_uploadedAt_idx" ON "GroupQRCode"("entry", "uploadedAt");
