# CLAUDE.md

此文件为 Claude Code 在此代码库中工作时提供指导。

## 项目概述

**@tsfullstack/backend** - TypeScript 全栈后端，基于 Fastify + Prisma + ZenStack + Effect 构建。

## 核心架构

- **服务器层** (`src/server/`) - Fastify HTTP 服务器
- **API 层** (`src/api/`) - 模块化业务逻辑
- **Context 层** (`src/Context/`) - Effect Context 依赖注入
- **RPC 系统** (`src/rpc/`) - 类型安全的远程调用
- **数据库层** (`src/db/`) - ZenStack 增强的 Prisma
- **OAuth** (`src/OAuth/`) - GitHub 认证
- **动态项目** (`src/projects/`) - 可动态加载的后端模块

## 核心特性

1. **Effect 函数式架构** - 错误处理和依赖管理
2. **RPC 系统** - 类型安全、安全机制、中间件支持
3. **ZenStack 安全性** - 声明式访问控制、RBAC
4. **多方式认证** - 邮箱密码 + GitHub OAuth
5. **AI 集成** - 多模型支持、代理服务、调用日志
6. **文件处理** - 本地存储、元数据追踪、权限控制
7. **队列系统** - 任务队列、优先级、定时任务
8. **监控系统** - 内存监控、智能日志

## 开发命令

```bash
# 开发和构建
pnpm dev              # 开发模式
pnpm build:lib        # 构建前端库
pnpm build            # 构建后端
pnpm test             # 运行测试
pnpm tsc              # 类型检查

# 数据库（修改 schema.zmodel 后）
pnpm zenstack generate    # 生成客户端
pnpm prisma migrate dev   # 运行迁移

# 动态项目
pnpm build:projects   # 构建动态项目
pnpm dev:projects     # 开发模式启动
```

## 开发规范

- **类型安全**: 严格模式，禁用 `any`，优先使用 Effect
- **代码质量**: 函数式编程，充分利用类型推导
- **构建要求**: API/schema 修改 api 下的代码，或者 projects 下的代码后必须执行 `pnpm build:lib`

## 配置管理: apps/backend/CONFIG.md