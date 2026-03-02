-- Migration: add_performance_indexes_and_new_tables
-- Description: 添加代币系统、任务系统、资源系统及相关性能优化索引
--
-- 这个迁移包含：
-- 1. 新增 6 个业务表（TokenPackage, Token, TokenTransaction, UserTokenSubscription, Task, Resource）
-- 2. 为现有表添加性能优化索引（User, UserSession, Role）
--
-- 注意：所有操作都使用 IF NOT EXISTS，确保迁移可以重复执行
-- 这样同一个迁移文件既可以应用到本地（已有数据），也可以应用到线上（全新）

-- ============================================
-- 新增业务表
-- ============================================

-- TokenPackage: 代币套餐表
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
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "restrictedType" JSON
);

-- Token: 代币记录表
CREATE TABLE IF NOT EXISTS "Token" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "restrictedType" JSON,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system',
    "sourceId" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- TokenTransaction: 代币消耗记录表
CREATE TABLE IF NOT EXISTS "TokenTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "tokenType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" INTEGER NOT NULL,
    "balanceSnapshot" JSON NOT NULL,
    "note" TEXT,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- UserTokenSubscription: 用户套餐订阅表
CREATE TABLE IF NOT EXISTS "UserTokenSubscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "nextGrantDate" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "grantsCount" INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("packageId") REFERENCES "TokenPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Task: 任务队列表
CREATE TABLE IF NOT EXISTS "Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "inputParams" JSON NOT NULL,
    "outputResult" JSON,
    "tokenCost" INTEGER NOT NULL,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "externalTaskId" TEXT,
    "tags" TEXT,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Resource: 资源记录表
CREATE TABLE IF NOT EXISTS "Resource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSON NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileId" INTEGER,
    "taskId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "tags" TEXT,
    FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================
-- 性能优化索引
-- ============================================

-- User 表：优化按创建时间排序查询
CREATE INDEX IF NOT EXISTS "User_created_idx" ON "User"("created");

-- UserSession 表：优化会话查询和过期检查
CREATE INDEX IF NOT EXISTS "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "UserSession_token_idx" ON "UserSession"("token");

-- Role 表：优化角色名称查询
CREATE INDEX IF NOT EXISTS "Role_name_idx" ON "Role"("name");

-- TokenPackage 表：优化套餐列表查询
CREATE INDEX IF NOT EXISTS "TokenPackage_active_sortOrder_idx" ON "TokenPackage"("active", "sortOrder");

-- Token 表：优化代币查询
CREATE INDEX IF NOT EXISTS "Token_expiresAt_idx" ON "Token"("expiresAt");
CREATE INDEX IF NOT EXISTS "Token_userId_active_idx" ON "Token"("userId", "active");
CREATE INDEX IF NOT EXISTS "Token_userId_type_expiresAt_idx" ON "Token"("userId", "type", "expiresAt");

-- TokenTransaction 表：优化交易记录查询
CREATE INDEX IF NOT EXISTS "TokenTransaction_taskId_idx" ON "TokenTransaction"("taskId");
CREATE INDEX IF NOT EXISTS "TokenTransaction_userId_created_idx" ON "TokenTransaction"("userId", "created");
CREATE INDEX IF NOT EXISTS "TokenTransaction_userId_taskId_idx" ON "TokenTransaction"("userId", "taskId");

-- UserTokenSubscription 表：优化订阅查询
CREATE INDEX IF NOT EXISTS "UserTokenSubscription_nextGrantDate_idx" ON "UserTokenSubscription"("nextGrantDate");
CREATE INDEX IF NOT EXISTS "UserTokenSubscription_userId_active_idx" ON "UserTokenSubscription"("userId", "active");

-- Task 表：优化任务查询
CREATE INDEX IF NOT EXISTS "Task_status_created_idx" ON "Task"("status", "created");
CREATE INDEX IF NOT EXISTS "Task_type_created_idx" ON "Task"("type", "created");
CREATE INDEX IF NOT EXISTS "Task_userId_status_idx" ON "Task"("userId", "status");
CREATE INDEX IF NOT EXISTS "Task_userId_type_idx" ON "Task"("userId", "type");

-- Resource 表：优化资源查询
CREATE INDEX IF NOT EXISTS "Resource_status_created_idx" ON "Resource"("status", "created");
CREATE INDEX IF NOT EXISTS "Resource_taskId_idx" ON "Resource"("taskId");
CREATE INDEX IF NOT EXISTS "Resource_userId_type_idx" ON "Resource"("userId", "type");
