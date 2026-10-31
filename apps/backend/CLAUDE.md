## 项目概述

**@tsfullstack/backend** - TypeScript 全栈后端，基于 ZenStack + Effect 构建。

## 核心架构

- **服务器层** (`src/server/`) - Fastify HTTP 服务器
- **API 层** (`src/api/`) - 模块化业务逻辑
- **Context 层** (`src/Context/`) - Effect Context 依赖注入
- **RPC 系统** (`src/rpc/`) - 类型安全的远程调用
- **OAuth** (`src/OAuth/`) - GitHub 认证
- **动态项目** (`src/projects/`) - 可动态加载的后端模块

## 开发命令

```bash
vp run dev       # 开发模式
vp run build:lib # 构建前端库
vp run build     # 构建后端
vp run tsc:b     # 类型检查,修改代码后可自行按需运行此命令检查修改是否正确
```

> **本项目使用 Vite+ (`vp`)**，依赖安装用 `vp install`，禁止直接使用 pnpm。

## 开发规范

- **绝对禁止执行 migrate reset清空数据库**
- **操作线上数据库前，必须先备份到本地再动手**：`scp "$SSH_TARGET:/root/app/TsFullStack/prisma/dev.db" ./backup/dev-$(date +%Y%m%d-%H%M%S).db`（SSH_TARGET 见 `.deploy-env`）。适用于 `zenstack migrate deploy`、修数据、删数据等一切写操作
- **类型安全**: 严格模式，禁用 `any`，优先使用 Effect
- **代码质量**: 函数式编程，充分利用类型推导
- **构建要求**: API/schema 修改 api 下的代码，或者 projects 下的代码后必须执行 `vp run build:lib`

- 使用 `vp run zen` 来替代本来的 prisma 命令
- 当前项目默认端口是 5209

## 多实例演进约束（写代码必须遵守）

现状是单实例 + SQLite，但**禁止再引入新的「跨请求安全状态放进程内存」的写法**，否则未来无法切多实例：

- **进程内存只允许两类**：① 纯性能缓存（失效可接受最终一致，如 authCache/modelsCache）；② 进程内诊断（LoopLagMonitor/diag）。**安全状态（限速计数、封禁标记、一次性票据、OAuth state、防重放表）一律走 DB 或统一的分布式 KV 接口层**（规划中，接口见 doc/多实例演进分析.md），不允许直接 `new Map` / 裸 `Cache.make` 存安全语义数据
- 新增限速/封禁/一次性凭证时：优先落 DB（参考 AiCallLog 的做法），或走 KV 接口层；写注释标注「单实例内存态」或「多实例安全」
- 失效广播：任何 `invalidateXxxCache` 类操作只影响本实例——设计上凡是「撤销需即时生效」的场景（登出、禁用），数据源必须可查 DB 兜底，不能只依赖内存缓存清除
- **数据库层不在多实例改造范围**（gs 拍板 2026-10-31）：切多实例时换非嵌入式数据库或做代理收敛到单台 DB 服务器，一致性由基础设施解决，ZenStack/Prisma 查询代码无需为此改动；uploads 本地存储同理由部署层解决
