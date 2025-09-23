/*
  Warnings:

  - A unique constraint covering the columns `[key,authorId]` on the table `Word` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Word_key_key";

-- CreateIndex
CREATE UNIQUE INDEX "Word_key_authorId_key" ON "Word"("key", "authorId");
