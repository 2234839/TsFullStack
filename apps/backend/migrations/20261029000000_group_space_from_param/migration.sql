-- 空间模型收敛：项目/入口实体删除，公开链接 = /group/<空间名>；
-- 「用户从哪个项目来」改为链接 ?from= 参数，统计表按 date+space+from 记录。

-- GroupSpace：从旧 GroupProject 改名并回填公众号单例配置
DROP TABLE IF EXISTS "GroupSpace";

CREATE TABLE "GroupSpace" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "officialName" TEXT,
    "officialReplyKeyword" TEXT NOT NULL DEFAULT '加群',
    "officialGuideText" TEXT,
    "officialQrImagePath" TEXT
);

-- 存量回填：空间 = 旧项目；公众号单例配置回填到所有空间
INSERT INTO "GroupSpace" ("created", "updated", "id", "name", "displayName", "sortOrder",
                          "officialName", "officialReplyKeyword", "officialGuideText", "officialQrImagePath")
SELECT p."created", p."updated", p."id", p."name", p."displayName", p."sortOrder",
       o."name", o."replyKeyword", o."guideText", o."qrImagePath"
FROM "GroupProject" p
LEFT JOIN "GroupOfficialAccount" o ON o."id" = (SELECT MIN("id") FROM "GroupOfficialAccount");

CREATE UNIQUE INDEX "GroupSpace_name_key" ON "GroupSpace"("name");
CREATE INDEX "GroupSpace_sortOrder_idx" ON "GroupSpace"("sortOrder");

-- GroupQRCode：projectId → spaceId（id 空间沿用旧项目 id，1:1 对齐），去掉 entry 冗余列
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GroupQRCode" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spaceId" INTEGER NOT NULL,
    "groupName" TEXT,
    "imagePath" TEXT NOT NULL,
    "imageSize" INTEGER NOT NULL,
    "imageMime" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    CONSTRAINT "GroupQRCode_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "GroupSpace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GroupQRCode" ("created", "updated", "id", "spaceId", "groupName", "imagePath", "imageSize", "imageMime", "uploadedAt", "expiresAt", "status", "note")
SELECT "created", "updated", "id", "projectId", "groupName", "imagePath", "imageSize", "imageMime", "uploadedAt", "expiresAt", "status", "note" FROM "GroupQRCode";
DROP TABLE "GroupQRCode";
ALTER TABLE "new_GroupQRCode" RENAME TO "GroupQRCode";
CREATE INDEX "GroupQRCode_spaceId_status_idx" ON "GroupQRCode"("spaceId", "status");
CREATE INDEX "GroupQRCode_spaceId_uploadedAt_idx" ON "GroupQRCode"("spaceId", "uploadedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- GroupStatDaily：entry → space + from 联合主键；存量 from 记 '' 并保留原 entry 值进 space 列
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GroupStatDaily" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "date" TEXT NOT NULL,
    "space" TEXT NOT NULL,
    "from" TEXT NOT NULL DEFAULT '',
    "imgPv" INTEGER NOT NULL DEFAULT 0,
    "pagePv" INTEGER NOT NULL DEFAULT 0,
    "pageUv" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GroupStatDaily_pkey" PRIMARY KEY ("date", "space", "from")
);
INSERT INTO "new_GroupStatDaily" ("created", "updated", "date", "space", "from", "imgPv", "pagePv", "pageUv")
SELECT "created", "updated", "date", "entry", '', "imgPv", "pagePv", "pageUv" FROM "GroupStatDaily";
DROP TABLE "GroupStatDaily";
ALTER TABLE "new_GroupStatDaily" RENAME TO "GroupStatDaily";
CREATE INDEX "GroupStatDaily_date_idx" ON "GroupStatDaily"("date");
CREATE INDEX "GroupStatDaily_space_idx" ON "GroupStatDaily"("space");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- 删除不再需要的实体
DROP TABLE IF EXISTS "GroupEntry";
DROP TABLE IF EXISTS "GroupProject";
DROP TABLE IF EXISTS "GroupOfficialAccount";
