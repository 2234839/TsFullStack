-- CreateContentTable: 引入 Content 基类实现多态性
-- 这个迁移将 Post 模型重构为继承 Content 基类的多态结构

-- 1. 创建 Content 表（通用内容基类）
CREATE TABLE IF NOT EXISTS "Content" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    CONSTRAINT "Content_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 2. 将现有 Post 数据迁移到 Content 和新的 Post 表
-- 首先从旧 Post 表复制数据到 Content 表（如果 Content 表为空）
INSERT INTO "Content" ("id", "created", "updated", "type", "title", "content", "visibility", "authorId")
SELECT "id", "created", "updated", 'POST', "title", "content", "visibility", "authorId"
FROM "Post"
WHERE NOT EXISTS (SELECT 1 FROM "Content" WHERE "Content".id = "Post".id);

-- 3. 重命名旧 Post 表为 Post_old（如果存在）
ALTER TABLE "Post" RENAME TO "Post_old";

-- 4. 创建新的 Post 表（继承 Content）
CREATE TABLE IF NOT EXISTS "Post" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parentId" INTEGER,
    CONSTRAINT "Post_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 5. 从 Post_old 恢复 parentId 数据到新 Post 表（如果 Post_old 存在）
INSERT INTO "Post" ("id", "created", "updated", "parentId")
SELECT "id", "created", "updated", "parentId"
FROM "Post_old"
WHERE NOT EXISTS (SELECT 1 FROM "Post" WHERE "Post".id = "Post_old".id);

-- 6. 删除旧 Post 表（如果存在）
DROP TABLE IF EXISTS "Post_old";

-- 7. 创建 Content 表的索引（如果不存在）
CREATE INDEX IF NOT EXISTS "Content_authorId_type_created_idx" ON "Content"("authorId", "type", "created");
CREATE INDEX IF NOT EXISTS "Content_visibility_created_idx" ON "Content"("visibility", "created");

-- 8. 为 Post 表创建索引（保持原有索引，如果不存在）
CREATE INDEX IF NOT EXISTS "Post_parentId_created_idx" ON "Post"("parentId", "created");
