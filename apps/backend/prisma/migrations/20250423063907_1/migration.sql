-- CreateTable
CREATE TABLE "SystemLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" TEXT NOT NULL,
    "message" TEXT,
    "input" JSONB,
    "output" JSONB,
    "authUserId" TEXT
);
