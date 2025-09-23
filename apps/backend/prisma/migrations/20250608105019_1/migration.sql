/*
  Warnings:

  - You are about to drop the column `reqId` on the `SystemLog` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SystemLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" TEXT NOT NULL,
    "message" TEXT,
    "logs" JSONB,
    "authUserId" TEXT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SystemLog" ("authUserId", "created", "id", "level", "logs", "message") SELECT "authUserId", "created", "id", "level", "logs", "message" FROM "SystemLog";
DROP TABLE "SystemLog";
ALTER TABLE "new_SystemLog" RENAME TO "SystemLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
