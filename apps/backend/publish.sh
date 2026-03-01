#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
SSH_USER="root"
SSH_HOST="shenzilong.cn"
DEPLOY_PATH="/root/app/TsFullStack"

# 构建目标地址
SSH_TARGET="$SSH_USER@$SSH_HOST"
REMOTE_PATH="$DEPLOY_PATH"

# SSH 配置
# 禁用连接复用以避免挂起问题
SSH_OPTS="-o ControlMaster=no -o ConnectTimeout=30"

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
ssh $SSH_OPTS "$SSH_TARGET" "
    mkdir -p $REMOTE_PATH/{dist/frontend,migrations} &&
    echo '环境准备完成'
" || { show_error "环境准备失败"; exit 1; }
show_success "远程环境准备完成"
timer_end

# 2. 文件同步阶段
show_progress "同步文件到服务器..."
timer_start

# 并行同步
{
    # 后端代码（排除 frontend 目录，避免删除前端文件）
    rsync -avz --delete --exclude='frontend' --compress-level=9 -e "ssh $SSH_OPTS" \
        ./dist/ "$SSH_TARGET:$REMOTE_PATH/dist/" &
    BACKEND_PID=$!

    # 前端代码
    rsync -avz --delete --compress-level=9 -e "ssh $SSH_OPTS" \
        ../website-frontend/dist/ "$SSH_TARGET:$REMOTE_PATH/dist/frontend/" &
    FRONTEND_PID=$!

    # 数据库迁移和配置文件
    rsync -avz --compress-level=9 -e "ssh $SSH_OPTS" \
        ./schema.zmodel \
        ./migrations \
        ./config.schema.json \
        ./config.example.json \
        ./CONFIG.md \
        "$SSH_TARGET:$REMOTE_PATH/" &

    wait $BACKEND_PID $FRONTEND_PID $DB_PID 
} || { show_error "文件同步失败"; exit 1; }

show_success "文件同步完成"
timer_end

# 3. 部署执行阶段
show_progress "执行远程部署..."
timer_start

ssh $SSH_OPTS "$SSH_TARGET" "
    cd $REMOTE_PATH/

    # 停止应用服务，释放数据库锁定
    echo '停止应用服务...'
    pm2 stop TsFullStack || true

    # 等待进程完全停止
    sleep 10

    # 数据库迁移（生产环境使用 migrate deploy）
    echo '执行数据库迁移...'
    # 确保服务器上安装了 ZenStack CLI（用于解析 schema.zmodel）
    # 如果没有安装的话就需要安装一下
    # pnpm add -D \
    #     '@zenstackhq/cli@^3.4.1' \
    #     '@zenstackhq/schema@^3.4.1' \
    #     '@zenstackhq/plugin-policy@^3.4.1' || exit 1
    pnpm zenstack migrate deploy || exit 1

    # 重启应用
    echo '重启应用服务...'
    pm2 reload TsFullStack || exit 1

    echo '部署完成'
" || { show_error "远程部署失败"; exit 1; }

show_success "远程部署完成"
timer_end

# 清理
ssh $SSH_OPTS -O exit "$SSH_TARGET" 2>/dev/null || true

echo -e "${GREEN}🎉 部署成功完成！${NC}"