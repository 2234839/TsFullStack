-- CreateTable
CREATE TABLE "Word" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "word" TEXT NOT NULL,
    "memoryLevel" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "translations" JSONB NOT NULL,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "aiTranslation" TEXT,
    "difficulty" REAL,
    "examples" JSONB,
    "grammar" TEXT,
    "pronunciation" TEXT,
    "authorId" TEXT NOT NULL,
    CONSTRAINT "Word_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
