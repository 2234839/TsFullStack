#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量（从 .deploy-env 读取，不存在则报错）
DEPLOY_ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.deploy-env"
if [ -f "$DEPLOY_ENV_FILE" ]; then
    source "$DEPLOY_ENV_FILE"
fi
: "${SSH_USER:?请设置 SSH_USER，可写入项目根目录 .deploy-env 文件}"
: "${SSH_HOST:?请设置 SSH_HOST，可写入项目根目录 .deploy-env 文件}"
: "${DEPLOY_PATH:?请设置 DEPLOY_PATH，可写入项目根目录 .deploy-env 文件}"

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

# 本地生成 prisma schema + 迁移目录快照（zenstack CLI 需 Node 21+，远端 Node 20 只能用 prisma CLI 跑迁移；
# prisma migrate deploy 在 schema 同级 migrations/ 找迁移，故两者都放进 prisma-deploy/）
show_progress "生成 prisma schema..."
node ./scripts/gen-prisma-schema.mjs || { show_error "prisma schema 生成失败"; exit 1; }
rm -rf ./prisma-deploy/migrations && cp -r ./migrations ./prisma-deploy/migrations

# 生成远端专用 package.json：剥离 workspace 协议依赖（note-calc-engine 已 alwaysBundle 内联进 dist，
# 远端运行时不需要；zenstack/prisma CLI 需真实安装）
node -e "
const pkg = require('./package.json');
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  if (pkg[section]) {
    for (const name of Object.keys(pkg[section])) {
      if (pkg[section][name].startsWith('workspace:')) delete pkg[section][name];
    }
  }
}
// catalog: 协议（devDependencies 的 vite/vitest 等）远端由 pnpm-workspace.yaml 解析，无需处理
require('fs').writeFileSync('./package.remote.json', JSON.stringify(pkg, null, 2) + '\n');
"

ssh $SSH_OPTS "$SSH_TARGET" "
    mkdir -p $REMOTE_PATH/{dist/frontend,migrations,prisma-deploy} &&
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

    # 前端依赖的后端库（dist-lib 供前端 RPC 导入使用）
    rsync -avz --delete --compress-level=9 -e "ssh $SSH_OPTS" \
        ./dist-lib/ "$SSH_TARGET:$REMOTE_PATH/dist-lib/" &
    DISTLIB_PID=$!

    # 前端代码
    rsync -avz --delete --compress-level=9 -e "ssh $SSH_OPTS" \
        ../website-frontend/dist/ "$SSH_TARGET:$REMOTE_PATH/dist/frontend/" &
    FRONTEND_PID=$!

    # 数据库迁移和配置文件
    rsync -avz --compress-level=9 -e "ssh $SSH_OPTS" \
        ./schema.zmodel \
        ./package.remote.json \
        ./pnpm-lock.yaml \
        ../../pnpm-workspace.yaml \
        ./migrations \
        ./config.schema.json \
        ./config.example.json \
        ./CONFIG.md \
        "$SSH_TARGET:$REMOTE_PATH/" &

    # prisma schema（多源 rsync 会摊平目录结构，单独传保持 prisma-deploy/ 路径）
    rsync -avz --compress-level=9 -e "ssh $SSH_OPTS" \
        ./prisma-deploy/ \
        "$SSH_TARGET:$REMOTE_PATH/prisma-deploy/" &

    wait $BACKEND_PID $DISTLIB_PID $FRONTEND_PID $DB_PID 
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

    # 安装依赖（prisma CLI 在 devDependencies，不能 --prod；zenstack 生成物已随 dist 内联，
    # 远端 Node20 跑不了 zenstack CLI，迁移用 prisma CLI + 本地预生成的 schema）
    echo '安装依赖...'
    mv package.remote.json package.json
    pnpm install --no-frozen-lockfile || exit 1

    # better-sqlite3 被 ignoredBuiltDependencies 跳过原生编译，需显式 rebuild（否则运行时 bindings 报错）
    pnpm rebuild better-sqlite3 || exit 1

    echo '应用数据库迁移...'
    DATABASE_URL="file:$REMOTE_PATH/prisma/dev.db" \
      node node_modules/prisma/build/index.js migrate deploy --schema ./prisma-deploy/schema.prisma || exit 1

    # 重启应用（设置 DATABASE_URL 环境变量）
    echo '重启应用服务...'
    pm2 delete TsFullStack || true
    cd $REMOTE_PATH/
    DATABASE_URL="file:$REMOTE_PATH/prisma/dev.db" \
      pm2 start ./dist/index.mjs --name "TsFullStack" --node-args="--enable-source-maps" || exit 1
    pm2 save

    echo '部署完成'
" || { show_error "远程部署失败"; exit 1; }

show_success "远程部署完成"
timer_end

# 清理
ssh $SSH_OPTS -O exit "$SSH_TARGET" 2>/dev/null || true

echo -e "${GREEN}🎉 部署成功完成！${NC}"