# CLAUDE.md

为 Claude Code 提供项目指导。

## 项目概述

TsFullStack 是一个 TypeScript 全栈框架，支持前端直接操作数据库，无需编写后端 API 代码。

### 核心技术栈
- **后端**: TypeScript + Prisma + ZenStack + Effect + Fastify
- **前端**: TypeScript + Vue 3 + Tailwind CSS + PrimeVue
- **浏览器扩展**: WXT + Vue 3 + Tailwind CSS + PrimeVue

### 开发工作流

```bash
# 后端开发 (apps/backend/)
pnpm zenstack generate    # 生成 Prisma 客户端
pnpm prisma migrate dev   # 运行数据库迁移
pnpm build:lib            # 构建库包供前端使用
pnpm dev                  # 启动开发服务器

# 前端开发 (apps/website-frontend/)
pnpm dev                  # 启动开发服务器
pnpm build                # 构建生产版本
pnpm tsc                  # 类型检查

# 浏览器扩展 (apps/InfoFlow/)
pnpm dev                  # 启动开发服务器
pnpm build                # 构建扩展
```

### 重要说明

**数据库管理**
- 使用 `schema.zmodel` 而不是 `prisma/schema.prisma`（自动生成）
- 修改 schema 后必须运行 `pnpm zenstack generate`

**类型安全**
- 项目强调严格的 TypeScript 类型检查
- 避免使用 `any` 类型
- 后端需要构建为库 (`pnpm build:lib`) 供前端导入类型

**架构特性**
- ZenStack: 声明式访问控制和行级安全
- RPC 系统: 前端直接调用后端 API，完整类型安全
- Effect: 函数式编程的错误处理和依赖注入
