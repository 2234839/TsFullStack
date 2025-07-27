#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# SSH 配置
SSH_OPTS="-o ControlMaster=auto -o ControlPath=/tmp/ssh-deploy-%r@%h:%p -o ControlPersist=600"

# 显示进度函数
show_progress() {
    local message=$1
    echo -e "${BLUE}🔄 $message${NC}"
}

show_success() {
    local message=$1
    echo -e "${GREEN}✅ $message${NC}"
}

show_error() {
    local message=$1
    echo -e "${RED}❌ $message${NC}"
}

# 计时函数
timer_start() {
    START_TIME=$(date +%s)
}

timer_end() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    echo -e "${YELLOW}⏱️  耗时: ${duration} 秒${NC}"
}

echo -e "${GREEN}🚀 开始部署 TsFullStack 应用${NC}"
timer_start

# 1. 准备阶段
show_progress "准备远程环境..."
ssh $SSH_OPTS root@47.236.134.32 "
    mkdir -p /root/app/TsFullStack/{dist/frontend,prisma/migrations} &&
    echo '环境准备完成'
" || { show_error "环境准备失败"; exit 1; }
show_success "远程环境准备完成"
timer_end

# 2. 文件同步阶段
show_progress "同步文件到服务器..."
timer_start

# 并行同步
{
    # 后端代码
    rsync -avz --delete --compress-level=9 -e "ssh $SSH_OPTS" \
        ./dist/ root@47.236.134.32:/root/app/TsFullStack/dist/ &
    BACKEND_PID=$!

    # 前端代码
    rsync -avz --delete --compress-level=9 -e "ssh $SSH_OPTS" \
        ../website-frontend/dist/ root@47.236.134.32:/root/app/TsFullStack/dist/frontend/ &
    FRONTEND_PID=$!

    # 数据库迁移和 Prisma 文件 以及 Prisma 引擎二进制
    rsync -avz --delete --compress-level=9 -e "ssh $SSH_OPTS" \
        ./prisma/{migrations,schema.prisma} \
        ./node_modules/prisma/libquery_engine-debian-openssl-3.0.x.so.node \
        root@47.236.134.32:/root/app/TsFullStack/ &
    DB_PID=$!

    wait $BACKEND_PID $FRONTEND_PID $DB_PID
} || { show_error "文件同步失败"; exit 1; }

show_success "文件同步完成"
timer_end

# 3. 部署执行阶段
show_progress "执行远程部署..."
timer_start

ssh $SSH_OPTS root@47.236.134.32 "
    cd /root/app/TsFullStack/

    # 数据库迁移
    echo '执行数据库迁移...'
    pnpm prisma migrate deploy || exit 1

    # 重启应用
    echo '重启应用服务...'
    pm2 reload TsFullStack || exit 1

    echo '部署完成'
" || { show_error "远程部署失败"; exit 1; }

show_success "远程部署完成"
timer_end

# 清理
ssh $SSH_OPTS -O exit root@47.236.134.32 2>/dev/null || true

echo -e "${GREEN}🎉 部署成功完成！${NC}"