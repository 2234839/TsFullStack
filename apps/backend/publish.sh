#!/bin/bash

# 统一设置 SSH 环境变量
export LANG=en_US.UTF-8
export LC_ALL=C


echo "🚀 开始同步 dist 目录..."
ssh root@47.236.134.32 "mkdir -p /root/app/TsFullStack/dist"
rsync -avz ./dist/* root@47.236.134.32:/root/app/TsFullStack/dist/

echo "🌐 同步前端文件..."
ssh root@47.236.134.32 "mkdir -p /root/app/TsFullStack/dist/frontend"
rsync -avz ../website-frontend/dist/* root@47.236.134.32:/root/app/TsFullStack/dist/frontend/

echo "🗄️ 同步数据库迁移文件..."
ssh root@47.236.134.32 "mkdir -p /root/app/TsFullStack/prisma/migrations"
rsync -avz ./prisma/migrations/* root@47.236.134.32:/root/app/TsFullStack/prisma/migrations/

echo "📄 同步 Prisma schema..."
rsync -avz ./prisma/schema.prisma root@47.236.134.32:/root/app/TsFullStack/prisma/

echo "⚙️ 同步数据库引擎..."
rsync -avz ./node_modules/prisma/libquery_engine-debian-openssl-3.0.x.so.node root@47.236.134.32:/root/app/TsFullStack/

echo "🔁 执行数据库迁移..."
ssh root@47.236.134.32 "cd /root/app/TsFullStack/ && pnpm prisma migrate deploy"

echo "🔄 重启应用..."
ssh root@47.236.134.32 "pm2 reload TsFullStack"

echo "✅ 部署完成！"