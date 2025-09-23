/*
  Warnings:

  - You are about to alter the column `result` on the `Queue` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Queue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "workerId" TEXT,
    "result" JSONB,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Queue" ("attempts", "completedAt", "created", "error", "id", "maxAttempts", "name", "payload", "priority", "result", "runAt", "startedAt", "status", "updated", "workerId") SELECT "attempts", "completedAt", "created", "error", "id", "maxAttempts", "name", "payload", "priority", "result", "runAt", "startedAt", "status", "updated", "workerId" FROM "Queue";
DROP TABLE "Queue";
ALTER TABLE "new_Queue" RENAME TO "Queue";
CREATE INDEX "Queue_status_runAt_priority_idx" ON "Queue"("status", "runAt", "priority");
CREATE INDEX "Queue_name_status_idx" ON "Queue"("name", "status");
CREATE INDEX "Queue_workerId_status_idx" ON "Queue"("workerId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
