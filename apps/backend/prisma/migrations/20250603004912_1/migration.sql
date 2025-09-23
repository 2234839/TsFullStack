/*
  Warnings:

  - You are about to drop the column `totalSessions` on the `Word` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Word" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "key" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "memoryLevel" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "translations" JSONB NOT NULL,
    "aiTranslation" TEXT,
    "difficulty" REAL,
    "examples" JSONB,
    "grammar" TEXT,
    "pronunciation" TEXT,
    "authorId" TEXT NOT NULL,
    CONSTRAINT "Word_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Word" ("aiTranslation", "authorId", "clickCount", "created", "difficulty", "examples", "grammar", "id", "key", "lastClickTime", "memoryLevel", "pronunciation", "translations", "updated", "word") SELECT "aiTranslation", "authorId", "clickCount", "created", "difficulty", "examples", "grammar", "id", "key", "lastClickTime", "memoryLevel", "pronunciation", "translations", "updated", "word" FROM "Word";
DROP TABLE "Word";
ALTER TABLE "new_Word" RENAME TO "Word";
CREATE UNIQUE INDEX "Word_key_authorId_key" ON "Word"("key", "authorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
