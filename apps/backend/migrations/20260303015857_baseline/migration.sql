-- CreateTable
CREATE TABLE "Role" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "nickname" TEXT
);

-- CreateTable
CREATE TABLE "Resource" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileId" INTEGER,
    "taskId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "tags" TEXT,
    CONSTRAINT "Resource_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Resource_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Resource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSession" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "profile" JSONB,
    CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'private',
    "authorId" TEXT NOT NULL,
    CONSTRAINT "File_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" TEXT NOT NULL,
    "message" TEXT,
    "logs" JSONB,
    "authUserId" TEXT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserData" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT NOT NULL,
    "tags" TEXT,
    "appId" TEXT,
    CONSTRAINT "UserData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Queue" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "workerId" TEXT,
    "result" JSONB,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Post" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "parentId" INTEGER,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Post_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Word" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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

-- CreateTable
CREATE TABLE "AiModel" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelType" TEXT NOT NULL DEFAULT 'TEXT',
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 100,
    "rpmLimit" INTEGER NOT NULL DEFAULT 60,
    "rphLimit" INTEGER NOT NULL DEFAULT 1000,
    "rpdLimit" INTEGER NOT NULL DEFAULT 10000,
    "description" TEXT,
    "config" JSONB
);

-- CreateTable
CREATE TABLE "AiCallLog" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientIp" TEXT NOT NULL,
    "userId" TEXT,
    "aiModelId" INTEGER NOT NULL,
    "modelName" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TokenPackage" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "price" INTEGER,
    "durationMonths" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "restrictedType" JSONB NOT NULL DEFAULT []
);

-- CreateTable
CREATE TABLE "UserTokenSubscription" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "packageId" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "nextGrantDate" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "grantsCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserTokenSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserTokenSubscription_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TokenPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Token" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "restrictedType" JSONB NOT NULL DEFAULT [],
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system',
    "sourceId" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TokenTransaction" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" INTEGER NOT NULL,
    "tokenType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" INTEGER NOT NULL,
    "balanceSnapshot" JSONB NOT NULL,
    "note" TEXT,
    CONSTRAINT "TokenTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TokenTransaction_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "inputParams" JSONB NOT NULL,
    "outputResult" JSONB,
    "tokenCost" INTEGER NOT NULL,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "externalTaskId" TEXT,
    "tags" TEXT,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_created_idx" ON "User"("created");

-- CreateIndex
CREATE INDEX "Resource_userId_type_idx" ON "Resource"("userId", "type");

-- CreateIndex
CREATE INDEX "Resource_taskId_idx" ON "Resource"("taskId");

-- CreateIndex
CREATE INDEX "Resource_status_created_idx" ON "Resource"("status", "created");

-- CreateIndex
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "UserSession_token_idx" ON "UserSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "UserData_userId_key_appId_key" ON "UserData"("userId", "key", "appId");

-- CreateIndex
CREATE INDEX "Queue_status_runAt_priority_idx" ON "Queue"("status", "runAt", "priority");

-- CreateIndex
CREATE INDEX "Queue_name_status_idx" ON "Queue"("name", "status");

-- CreateIndex
CREATE INDEX "Queue_workerId_status_idx" ON "Queue"("workerId", "status");

-- CreateIndex
CREATE INDEX "Post_parentId_created_idx" ON "Post"("parentId", "created");

-- CreateIndex
CREATE INDEX "Post_visibility_created_idx" ON "Post"("visibility", "created");

-- CreateIndex
CREATE UNIQUE INDEX "Word_key_authorId_key" ON "Word"("key", "authorId");

-- CreateIndex
CREATE INDEX "AiCallLog_clientIp_timestamp_idx" ON "AiCallLog"("clientIp", "timestamp");

-- CreateIndex
CREATE INDEX "AiCallLog_userId_timestamp_idx" ON "AiCallLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AiCallLog_aiModelId_timestamp_idx" ON "AiCallLog"("aiModelId", "timestamp");

-- CreateIndex
CREATE INDEX "AiCallLog_modelName_timestamp_idx" ON "AiCallLog"("modelName", "timestamp");

-- CreateIndex
CREATE INDEX "AiCallLog_userId_modelName_idx" ON "AiCallLog"("userId", "modelName");

-- CreateIndex
CREATE INDEX "TokenPackage_active_sortOrder_idx" ON "TokenPackage"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "UserTokenSubscription_userId_active_idx" ON "UserTokenSubscription"("userId", "active");

-- CreateIndex
CREATE INDEX "UserTokenSubscription_nextGrantDate_idx" ON "UserTokenSubscription"("nextGrantDate");

-- CreateIndex
CREATE INDEX "Token_userId_type_expiresAt_idx" ON "Token"("userId", "type", "expiresAt");

-- CreateIndex
CREATE INDEX "Token_userId_active_idx" ON "Token"("userId", "active");

-- CreateIndex
CREATE INDEX "Token_expiresAt_idx" ON "Token"("expiresAt");

-- CreateIndex
CREATE INDEX "TokenTransaction_userId_taskId_idx" ON "TokenTransaction"("userId", "taskId");

-- CreateIndex
CREATE INDEX "TokenTransaction_userId_created_idx" ON "TokenTransaction"("userId", "created");

-- CreateIndex
CREATE INDEX "TokenTransaction_taskId_idx" ON "TokenTransaction"("taskId");

-- CreateIndex
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");

-- CreateIndex
CREATE INDEX "Task_userId_type_idx" ON "Task"("userId", "type");

-- CreateIndex
CREATE INDEX "Task_status_created_idx" ON "Task"("status", "created");

-- CreateIndex
CREATE INDEX "Task_type_created_idx" ON "Task"("type", "created");

-- CreateIndex
CREATE UNIQUE INDEX "_RoleToUser_AB_unique" ON "_RoleToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");
