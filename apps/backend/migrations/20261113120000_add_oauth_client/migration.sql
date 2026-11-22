-- 开放平台：接入应用注册表（其他网站用本站账号登录）
CREATE TABLE "OAuthClient" (
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" DATETIME NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientId" TEXT NOT NULL UNIQUE,
    "clientSecretHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homepage" TEXT,
    "redirectUris" JSONB NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "OAuthClient_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OAuthClient_clientId_key" ON "OAuthClient" ("clientId");
