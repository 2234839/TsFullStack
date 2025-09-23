/*
  Warnings:

  - Added the required column `reqId` to the `SystemLog` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SystemLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reqId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT,
    "input" JSONB,
    "output" JSONB,
    "authUserId" TEXT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SystemLog" ("authUserId", "created", "id", "input", "level", "message", "output") SELECT "authUserId", "created", "id", "input", "level", "message", "output" FROM "SystemLog";
DROP TABLE "SystemLog";
ALTER TABLE "new_SystemLog" RENAME TO "SystemLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
