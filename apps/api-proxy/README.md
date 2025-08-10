# API Proxy

这是一个基于 Cloudflare Workers 的通用 API 代理服务，用于解决无法直接访问 GitHub、npm 等外部 API 的问题。

## 功能特性

- **通用代理**: 支持 GitHub 和 npm API 的代理访问
- **CORS 支持**: 完整的 CORS 配置，支持浏览器端调用
- **多种访问方式**: 提供直接代理和通用代理两种方式
- **安全验证**: 只允许访问预定义的域名，防止滥用

## 支持的平台

- **GitHub API**: `api.github.com`, `github.com`, `raw.githubusercontent.com`
- **npm API**: `registry.npmjs.org`

## 部署步骤

### 1. 环境准备

确保已安装：
- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- [Cloudflare 账户](https://dash.cloudflare.com/sign-up)

### 2. 安装依赖

```bash
cd apps/api-proxy
pnpm install
```

### 3. 登录 Cloudflare

首次使用需要登录 Cloudflare 账户：

```bash
# 这会打开浏览器进行登录
pnpm exec wrangler login
```

如果遇到登录问题：
```bash
# 使用辅助脚本
./login.sh
```

### 4. 开发测试

```bash
# 启动本地开发服务器
pnpm dev
```

访问 http://localhost:8787 查看本地测试。

### 5. 部署到 Cloudflare Workers

```bash
# 一键部署
./deploy.sh

# 或手动部署
pnpm run deploy
```

部署成功后，你会得到一个 `*.workers.dev` 域名，例如：
`https://api-proxy.your-subdomain.workers.dev`

## 使用方法

### 1. 健康检查

```bash
curl https://api-proxy.your-subdomain.workers.dev/health
```

### 2. 直接代理方式

#### GitHub API
```bash
# 获取用户信息
curl https://api-proxy.your-subdomain.workers.dev/github/user/username

# 获取仓库信息
curl https://api-proxy.your-subdomain.workers.dev/github/repos/owner/repo
```

#### npm API
```bash
# 获取包信息
curl https://api-proxy.your-subdomain.workers.dev/npm/package-name

# 获取包版本信息
curl https://api-proxy.your-subdomain.workers.dev/npm/package-name/1.0.0
```

### 3. 通用代理方式

```bash
# POST 请求到 /proxy 端点
curl -X POST https://api-proxy.your-subdomain.workers.dev/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.github.com/user/username",
    "method": "GET",
    "headers": {
      "Authorization": "token your-token"
    }
  }'
```

## 在项目中使用

### 设置 npm 镜像源

```bash
# 设置 npm 使用代理
npm config set registry https://api-proxy.your-subdomain.workers.dev/npm/

# 设置 pnpm 使用代理
pnpm config set registry https://api-proxy.your-subdomain.workers.dev/npm/
```

### 设置 Git 代理

```bash
# 配置 Git 使用代理
git config --global http.https://api.github.com.proxy https://api-proxy.your-subdomain.workers.dev/github/
git config --global https://github.com.proxy https://api-proxy.your-subdomain.workers.dev/github/
```

## API 端点

- `GET /health` - 健康检查
- `POST /proxy` - 通用代理端点
- `GET/POST /github/*` - GitHub API 代理
- `GET/POST /npm/*` - npm API 代理

## 错误处理

服务会返回标准的 HTTP 状态码和 JSON 格式的错误信息：

```json
{
  "error": "错误类型",
  "message": "详细错误信息"
}
```

## 安全考虑

- 只允许访问预定义的域名（GitHub 和 npm）
- 自动添加 User-Agent 头部
- 支持 CORS 但限制来源
- 不记录请求日志

## 开发

```bash
# 本地开发
pnpm dev

# 构建检查
pnpm build
```

## 许可证

MIT License