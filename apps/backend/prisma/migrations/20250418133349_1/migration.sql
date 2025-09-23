-- CreateTable
CREATE TABLE "File" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "storageType" TEXT NOT NULL,
    "key" TEXT,
    "bucket" TEXT,
    "metadata" JSONB
);
