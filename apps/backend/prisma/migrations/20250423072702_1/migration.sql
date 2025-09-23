/*
  Warnings:

  - You are about to drop the column `input` on the `SystemLog` table. All the data in the column will be lost.
  - You are about to drop the column `output` on the `SystemLog` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SystemLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reqId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT,
    "logs" JSONB,
    "authUserId" TEXT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SystemLog" ("authUserId", "created", "id", "level", "message", "reqId") SELECT "authUserId", "created", "id", "level", "message", "reqId" FROM "SystemLog";
DROP TABLE "SystemLog";
ALTER TABLE "new_SystemLog" RENAME TO "SystemLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
