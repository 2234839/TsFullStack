# CLAUDE.md

此文件为 Claude Code 在此代码库中工作时提供指导。

## 项目概述

这是一个使用以下技术构建的 TypeScript 全栈应用后端：
- 使用 Fastify 作为 Web 服务器
- 使用 Prisma 和 ZenStack 进行数据库建模和访问
- 使用 Effect 实现函数式编程模式

后端提供完整的 API 服务，包括用户认证、文件上传功能和可扩展架构。

## 架构概述

### 核心组件

1. **服务器层** (`src/server/`) - 基于 Fastify 的 HTTP 服务器和中间件
2. **API 层** (`src/api/`) - 按模块组织的业务逻辑
3. **数据库层** (`src/db/`) - 使用 ZenStack 增强安全性的 Prisma 数据库访问
4. **服务层** (`src/service/`) - 使用 Effect Context 的可重用业务逻辑组件
5. **工具层** (`src/util/`) - 辅助函数和专用工具
6. **OAuth** (`src/OAuth/`) - 第三方认证实现

### 关键模式

1. **基于 Effect 的架构** - 使用 Effect 进行函数式错误处理和依赖管理
2. **RPC 系统** - 支持客户端和服务端使用的自定义远程过程调用系统
3. **ZenStack 安全性** - 数据模型中的声明式访问控制
4. **作业队列** - 基于 Prisma 的任务队列系统，支持调度功能
5. **文件上传** - 具有本地存储的安全文件处理

### 数据库模型

修改 shcema.zmodel 文件需要提醒用户运行以下命令，禁止你运行
```bash
# 这个命令将会自动运行 prisma generate (生成 prisma/client 代码)
pnpm zenstack generate
# 迁移数据库为修改后的模型
pnpm prisma migrate dev
```

## 重要说明

- 项目使用自定义 RPC 系统进行 API 调用，支持客户端和服务端使用
- 数据库操作通过 ZenStack 增强，实现自动访问控制
- 文件上传通过专用系统处理，文件存储在本地
- 应用包含作业队列系统用于后台任务处理
- 配置通过 c12 管理，默认值在 config.ts 中
- 应该通过执行 pnpm tsc 检查类型错误
- 我需要严谨的 ts 类型，尽量不要使用 any 之类的
- backend中的api 相关代码修改和 shcema.zmodel 修改后需要在backend项目下执行 pnpm build:lib 其他项目才能感知到接口更新