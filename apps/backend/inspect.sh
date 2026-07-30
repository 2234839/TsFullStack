#!/bin/bash
#
# TsFullStack 线上巡检脚本
# 用法: bash apps/backend/inspect.sh
#

set -euo pipefail

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 配置（从 .deploy-env 读取，不存在则报错）
DEPLOY_ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.deploy-env"
if [ -f "$DEPLOY_ENV_FILE" ]; then
    source "$DEPLOY_ENV_FILE"
fi
: "${BASE_URL:?请设置 BASE_URL，可写入项目根目录 .deploy-env 文件}"
: "${SSH_TARGET:?请设置 SSH_TARGET，可写入项目根目录 .deploy-env 文件}"
SSH_OPTS="-o ConnectTimeout=10"
LOCAL_REPO="$(cd "$(dirname "$0")/../.." && pwd)"

# 计数
PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}✅ $1${NC}"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}❌ $1${NC}"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; WARN=$((WARN + 1)); }

echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}${BOLD}  TsFullStack 线上巡检${NC}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════${NC}"
echo ""

# ── 1. 版本一致性 ───────────────────────────
echo -e "${BOLD}[1/5] 版本一致性${NC}"

LOCAL_COMMIT=$(cd "$LOCAL_REPO" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")

VERSION_JSON=$(curl -sf --max-time 10 "$BASE_URL/version" 2>/dev/null || echo "")
if [ -z "$VERSION_JSON" ]; then
    fail "/version 端点无响应"
else
    REMOTE_COMMIT=$(echo "$VERSION_JSON" | grep -oP '"commit":"\K[^"]+' || echo "unknown")
    BUILD_TIME=$(echo "$VERSION_JSON" | grep -oP '"buildTime":"\K[^"]+' || echo "unknown")

    if [ "$REMOTE_COMMIT" = "$LOCAL_COMMIT" ]; then
        pass "版本一致: $REMOTE_COMMIT"
    else
        fail "版本不一致: 本地=$LOCAL_COMMIT 线上=$REMOTE_COMMIT"
    fi
    echo -e "      构建时间: $BUILD_TIME"
fi
echo ""

# ── 2. HTTP 可达性 ──────────────────────────
echo -e "${BOLD}[2/5] HTTP 可达性${NC}"

check_http() {
    local path="$1"
    local label="$2"
    local expect="${3:-200}"
    local code
    code=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL$path" 2>/dev/null || echo "000")
    if [ "$code" = "$expect" ]; then
        pass "$label → HTTP $code"
    else
        fail "$label → HTTP $code (期望 $expect)"
    fi
}

check_http "/" "首页"
check_http "/login" "登录页 (SPA fallback)"
check_http "/admin" "管理后台"
check_http "/version" "版本端点"
echo ""

# ── 3. 后端 API ─────────────────────────────
echo -e "${BOLD}[3/5] 后端 API${NC}"

API_RESULT=$(ssh $SSH_OPTS "$SSH_TARGET" \
    "curl -sf -w '|%{http_code}' --max-time 10 http://localhost:5209/api/ 2>/dev/null" 2>/dev/null || echo "||000")

API_BODY=$(echo "$API_RESULT" | cut -d'|' -f1)
API_CODE=$(echo "$API_RESULT" | cut -d'|' -f2)

if [ "$API_CODE" = "200" ]; then
    pass "API → HTTP 200"
    if echo "$API_BODY" | grep -q '"error"'; then
        pass "API 返回有效 JSON（要求认证）"
    else
        warn "API 返回内容不含预期字段"
    fi
else
    fail "API → HTTP $API_CODE (期望 200)"
fi
echo ""

# ── 4. PM2 进程状态 ─────────────────────────
echo -e "${BOLD}[4/5] PM2 进程状态${NC}"

PM2_STATUS=$(ssh $SSH_OPTS "$SSH_TARGET" \
    "pm2 jlist 2>/dev/null" 2>/dev/null | python3 -c "
import sys, json
try:
    for p in json.load(sys.stdin):
        if p.get('name') == 'TsFullStack':
            env = p.get('pm2_env', {})
            monit = p.get('monit', {})
            print(env.get('status','?'), p.get('pid',0), env.get('restart_time',0), monit.get('memory',0))
            sys.exit(0)
    print('NOT_FOUND 0 0 0')
except Exception as e:
    print('ERROR 0 0 0')
" 2>/dev/null || echo "ERROR 0 0 0")

read -r PM2_STATE PM2_PID PM2_RESTARTS PM2_MEM <<< "$PM2_STATUS"

if [ "$PM2_STATE" = "NOT_FOUND" ]; then
    fail "PM2 未找到 TsFullStack 进程"
elif [ "$PM2_STATE" = "ERROR" ]; then
    fail "无法获取 PM2 状态"
else
    PM2_MEM_MB=$((PM2_MEM / 1048576))
    if [ "$PM2_STATE" = "online" ]; then
        pass "TsFullStack → online (PID: $PM2_PID, 内存: ${PM2_MEM_MB}MB)"
    else
        fail "TsFullStack → $PM2_STATE"
    fi
fi

if [ "${PM2_RESTARTS:-0}" -gt 10 ]; then
    warn "重启次数偏高: $PM2_RESTARTS 次（可能存在崩溃循环）"
elif [ "${PM2_RESTARTS:-0}" -ge 0 ]; then
    pass "重启次数正常: $PM2_RESTARTS"
fi
echo ""

# ── 5. 前端资源完整性 ───────────────────────
echo -e "${BOLD}[5/5] 前端资源完整性${NC}"

# 检查 index.html 是否引用了不存在的 JS 资源（部署不完整时常见）
INDEX_HTML=$(curl -sf --max-time 10 "$BASE_URL/" 2>/dev/null || echo "")
if [ -z "$INDEX_HTML" ]; then
    fail "无法获取 index.html"
else
    # 提取 script src 并检查第一个
    JS_FILE=$(echo "$INDEX_HTML" | grep -oP 'src="/assets/[^"]+\.js"' | head -1 | grep -oP '/assets/[^"]+\.js' || echo "")
    if [ -z "$JS_FILE" ]; then
        warn "index.html 中未找到 JS 资源引用"
    else
        JS_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL$JS_FILE" 2>/dev/null || echo "000")
        if [ "$JS_CODE" = "200" ]; then
            pass "主 JS 资源可达: $JS_FILE"
        else
            fail "主 JS 资源不可达: $JS_FILE → HTTP $JS_CODE"
        fi
    fi

    # 检查是否有 git 冲突标记残留
    if echo "$INDEX_HTML" | grep -q '<<<<<<<\|>>>>>>>'; then
        fail "index.html 中发现 git 冲突标记"
    else
        pass "index.html 无 git 冲突标记"
    fi
fi
echo ""

# ── 汇总 ────────────────────────────────────
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}通过: $PASS${NC}  ${RED}失败: $FAIL${NC}  ${YELLOW}警告: $WARN${NC}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════${NC}"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
