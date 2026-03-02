-- Migration: 20260302_sync_production
-- Description: 同步生产数据库到最新schema,添加缺失的表、字段和索引
-- 此迁移文件设计为幂等,可以在已有数据的数据库上安全执行

-- ====================================================================
-- 第一部分: 为已存在的表添加缺失字段
-- ====================================================================
-- 注意：SQLite 不支持 ALTER TABLE IF NOT EXISTS
-- 如果字段已存在，这条语句会报错 "duplicate column name"
-- 这是预期行为，对于生产环境，请先手动检查字段是否存在

ALTER TABLE "AiModel" ADD COLUMN "modelType" TEXT DEFAULT 'TEXT';
ALTER TABLE "AiModel" ADD COLUMN "config" TEXT;

-- ====================================================================
-- 第二部分: 创建新的业务表
-- ====================================================================

-- 3.1 代币套餐表
CREATE TABLE IF NOT EXISTS "TokenPackage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "price" INTEGER,
    "durationMonths" INTEGER NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "restrictedType" TEXT NOT NULL DEFAULT '[]'
);

-- 3.2 用户代币订阅表
CREATE TABLE IF NOT EXISTS "UserTokenSubscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "nextGrantDate" DATETIME NOT NULL,
    "active" INTEGER NOT NULL DEFAULT 1,
    "grantsCount" INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("packageId") REFERENCES "TokenPackage"("id") ON DELETE CASCADE
);

-- 3.3 代币记录表
CREATE TABLE IF NOT EXISTS "Token" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "restrictedType" TEXT NOT NULL DEFAULT '[]',
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system',
    "sourceId" TEXT,
    "description" TEXT,
    "active" INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- 3.4 代币消耗记录表
CREATE TABLE IF NOT EXISTS "TokenTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "tokenType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" INTEGER NOT NULL,
    "balanceSnapshot" TEXT NOT NULL,
    "note" TEXT,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE
);

-- 3.5 任务表
CREATE TABLE IF NOT EXISTS "Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "inputParams" TEXT NOT NULL,
    "outputResult" TEXT,
    "tokenCost" INTEGER NOT NULL,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "externalTaskId" TEXT,
    "tags" TEXT,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- 3.6 资源表
CREATE TABLE IF NOT EXISTS "Resource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileId" INTEGER,
    "taskId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "tags" TEXT,
    FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL,
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- ====================================================================
-- 第三部分: 创建性能优化索引
-- ====================================================================

-- User 表索引
CREATE INDEX IF NOT EXISTS "User_created_idx" ON "User"("created");

-- UserSession 表索引
CREATE INDEX IF NOT EXISTS "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "UserSession_token_idx" ON "UserSession"("token");

-- Role 表索引
CREATE INDEX IF NOT EXISTS "Role_name_idx" ON "Role"("name");

-- TokenPackage 表索引
CREATE INDEX IF NOT EXISTS "TokenPackage_active_sortOrder_idx" ON "TokenPackage"("active", "sortOrder");

-- UserTokenSubscription 表索引
CREATE INDEX IF NOT EXISTS "UserTokenSubscription_userId_active_idx" ON "UserTokenSubscription"("userId", "active");
CREATE INDEX IF NOT EXISTS "UserTokenSubscription_nextGrantDate_idx" ON "UserTokenSubscription"("nextGrantDate");

-- Token 表索引
CREATE INDEX IF NOT EXISTS "Token_userId_type_expiresAt_idx" ON "Token"("userId", "type", "expiresAt");
CREATE INDEX IF NOT EXISTS "Token_userId_active_idx" ON "Token"("userId", "active");
CREATE INDEX IF NOT EXISTS "Token_expiresAt_idx" ON "Token"("expiresAt");

-- TokenTransaction 表索引
CREATE INDEX IF NOT EXISTS "TokenTransaction_userId_taskId_idx" ON "TokenTransaction"("userId", "taskId");
CREATE INDEX IF NOT EXISTS "TokenTransaction_userId_created_idx" ON "TokenTransaction"("userId", "created");
CREATE INDEX IF NOT EXISTS "TokenTransaction_taskId_idx" ON "TokenTransaction"("taskId");

-- Task 表索引
CREATE INDEX IF NOT EXISTS "Task_userId_status_idx" ON "Task"("userId", "status");
CREATE INDEX IF NOT EXISTS "Task_userId_type_idx" ON "Task"("userId", "type");
CREATE INDEX IF NOT EXISTS "Task_status_created_idx" ON "Task"("status", "created");
CREATE INDEX IF NOT EXISTS "Task_type_created_idx" ON "Task"("type", "created");

-- Resource 表索引
CREATE INDEX IF NOT EXISTS "Resource_userId_type_idx" ON "Resource"("userId", "type");
CREATE INDEX IF NOT EXISTS "Resource_taskId_idx" ON "Resource"("taskId");
CREATE INDEX IF NOT EXISTS "Resource_status_created_idx" ON "Resource"("status", "created");
