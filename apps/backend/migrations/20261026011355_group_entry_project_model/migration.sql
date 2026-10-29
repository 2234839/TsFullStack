/*
  Warnings:

  - Added the required column `projectId` to the `GroupQRCode` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "GroupProject" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- 存量回填：每个旧 entry 视为一个项目（项目名即 entry 名）
INSERT INTO "GroupProject" ("created", "updated", "name", "displayName", "sortOrder")
SELECT "created", "updated", "entry", NULL, 0 FROM "GroupQRCode" GROUP BY "entry";

-- CreateTable
CREATE TABLE "GroupEntry" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "note" TEXT,
    CONSTRAINT "GroupEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GroupProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 存量回填：每个旧 entry 建立同名入口，指向同名项目
INSERT INTO "GroupEntry" ("created", "updated", "key", "projectId", "note")
SELECT g."created", g."updated", g."entry", p."id", '迁移自旧入口字段' FROM "GroupQRCode" g
JOIN "GroupProject" p ON p."name" = g."entry"
GROUP BY g."entry";

-- CreateTable
CREATE TABLE "GroupOfficialAccount" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "replyKeyword" TEXT NOT NULL DEFAULT '加群',
    "qrImagePath" TEXT,
    "guideText" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GroupQRCode" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "entry" TEXT NOT NULL,
    "groupName" TEXT,
    "imagePath" TEXT NOT NULL,
    "imageSize" INTEGER NOT NULL,
    "imageMime" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    CONSTRAINT "GroupQRCode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GroupProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GroupQRCode" ("created", "projectId", "entry", "expiresAt", "groupName", "id", "imageMime", "imagePath", "imageSize", "note", "status", "updated", "uploadedAt") SELECT old."created", p."id", old."entry", old."expiresAt", old."groupName", old."id", old."imageMime", old."imagePath", old."imageSize", old."note", old."status", old."updated", old."uploadedAt" FROM "GroupQRCode" old
JOIN "GroupProject" p ON p."name" = old."entry";
DROP TABLE "GroupQRCode";
ALTER TABLE "new_GroupQRCode" RENAME TO "GroupQRCode";
CREATE INDEX "GroupQRCode_projectId_status_idx" ON "GroupQRCode"("projectId", "status");
CREATE INDEX "GroupQRCode_projectId_uploadedAt_idx" ON "GroupQRCode"("projectId", "uploadedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GroupProject_name_key" ON "GroupProject"("name");

-- CreateIndex
CREATE INDEX "GroupProject_sortOrder_idx" ON "GroupProject"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GroupEntry_key_key" ON "GroupEntry"("key");
