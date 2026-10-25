-- CreateTable
CREATE TABLE "GroupStatDaily" (
    "date" TEXT NOT NULL,
    "entry" TEXT NOT NULL,
    "imgPv" INTEGER NOT NULL DEFAULT 0,
    "pagePv" INTEGER NOT NULL DEFAULT 0,
    "pageUv" INTEGER NOT NULL DEFAULT 0,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,

    PRIMARY KEY ("date", "entry")
);

-- CreateIndex
CREATE INDEX "GroupStatDaily_date_idx" ON "GroupStatDaily"("date");
