## 项目概述

TsFullStack 是一个 TypeScript 全栈框架，支持前端直接操作数据库，无需编写后端 API 代码。

### 核心技术栈

- **后端**: TypeScript + ZenStack(类似Prisma) + Effect + Fastify
- **前端**: TypeScript + Vue 3 + Tailwind CSS + reka-ui（自定义组件库）+ @vueuse/core (多多使用use来简化vue中的逻辑)
- **浏览器扩展**: WXT + Vue 3 + Tailwind CSS

### 开发工作流

> **本项目使用 Vite+ (`vp`) 作为统一工具链**，所有依赖安装、脚本运行、lint/format/type-check 均使用 `vp` 命令，禁止直接使用 pnpm。详见 `AGENTS.md`。

```bash
# 后端开发,需要在 apps/backend/ 目录下执行
vp run build:lib          # 构建后端api接口包供前端掉用
vp run dev                # 启动开发服务器

# 编译构建tsfullstack网站和后端并发布到服务器
vp run --filter @tsfullstack/backend build:publish

# 发布成功后打 tag 并推送
git tag vX.X.X && git push origin main --tags

# 前端开发 (apps/website-frontend/)
vp run build              # 构建生产版本
vp run tsc                # 类型检查

# 浏览器扩展 (apps/InfoFlow/)
vp run dev                # 启动开发服务器
vp run build              # 构建扩展
```

### [Shared Frontend Package](packages/shared-frontend)

这个子包提供在多个前端模块间共享的工具和组件

### 重要说明

**数据库管理**

- 修改模型: `schema.zmodel`
- 修改 schema 后必须运行 `vp run zen` 生成 ZenStack 客户端

**架构特性**

- ZenStack: 声明式访问控制和行级安全
- RPC 系统: 前端直接调用后端 API，完整类型安全
- Effect: 函数式编程的错误处理和依赖注入

**前端开发**

- 前端开发规范详见 [apps/website-frontend/CLAUDE.md](apps/website-frontend/CLAUDE.md)
