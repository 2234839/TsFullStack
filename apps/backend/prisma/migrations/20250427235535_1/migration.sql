-- CreateTable
CREATE TABLE "UserData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT NOT NULL,
    "tags" TEXT,
    "appId" TEXT,
    CONSTRAINT "UserData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserData_userId_key_appId_key" ON "UserData"("userId", "key", "appId");
