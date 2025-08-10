#!/bin/bash

# API Proxy 使用示例脚本
# 请将 WORKER_URL 替换为你的 Cloudflare Workers URL

WORKER_URL="https://api-proxy.gush.workers.dev"

echo "=== API Proxy 使用示例 ==="
echo "Worker URL: $WORKER_URL"
echo ""

# 检查依赖
if ! command -v curl &> /dev/null; then
    echo "错误: curl 未安装"
    exit 1
fi

# JSON 提取函数 - 从 JSON 中提取指定字段的值
extract_json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | cut -d'"' -f4
}

# JSON 格式化函数 - 简单的 JSON 格式化
format_json() {
    local json="$1"
    echo "$json" | sed 's/{/\n&/g' | sed 's/}/&\n/g' | sed 's/,/\n/g' | sed '/^[[:space:]]*$/d' | sed 's/^/  /'
}

# 1. 健康检查
echo "1. 健康检查:"
health_response=$(curl -s "$WORKER_URL/health")
if [[ $? -eq 0 ]]; then
    status=$(extract_json_field "$health_response" "status")
    message=$(extract_json_field "$health_response" "message")
    echo "  状态: $status"
    echo "  消息: $message"
else
    echo "  请求失败"
fi
echo ""

# 2. GitHub API 代理
echo "2. GitHub API 代理 - 获取 octocat 用户信息:"
github_response=$(curl -s "$WORKER_URL/github/users/octocat")
if [[ $? -eq 0 ]]; then
    login=$(extract_json_field "$github_response" "login")
    name=$(extract_json_field "$github_response" "name")
    company=$(extract_json_field "$github_response" "company")
    echo "  用户名: $login"
    echo "  姓名: $name"
    echo "  公司: $company"
else
    echo "  请求失败"
fi
echo ""

# 3. npm API 代理
echo "3. npm API 代理 - 获取 lodash 包信息:"
npm_response=$(curl -s "$WORKER_URL/npm/lodash")
if [[ $? -eq 0 ]]; then
    pkg_name=$(extract_json_field "$npm_response" "name")
    description=$(extract_json_field "$npm_response" "description")
    echo "  包名: $pkg_name"
    echo "  描述: $description"
else
    echo "  请求失败"
fi
echo ""

# 4. 通用代理方式
echo "4. 通用代理方式 - 获取 GitHub 仓库信息:"
proxy_response=$(curl -s -X POST "$WORKER_URL/proxy" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.github.com/repos/octocat/Hello-World",
    "method": "GET"
  }')
if [[ $? -eq 0 ]]; then
    repo_name=$(extract_json_field "$proxy_response" "name")
    repo_description=$(extract_json_field "$proxy_response" "description")
    echo "  仓库名: $repo_name"
    echo "  描述: $repo_description"
else
    echo "  请求失败"
fi
echo ""

# 5. 显示原始响应（可选）
echo "5. 原始响应示例（健康检查）:"
echo "$health_response" | format_json
echo ""

echo "=== 使用说明 ==="
echo "1. 请将 WORKER_URL 替换为你的实际 Workers URL"
echo "2. 如果需要认证，请在 headers 中添加 Authorization 头"
echo "3. 支持所有标准的 HTTP 方法 (GET, POST, PUT, DELETE 等)"
echo "4. 支持自定义请求头和请求体"
echo "5. 开发模式运行: pnpm dev"
echo "6. 部署: pnpm run deploy"