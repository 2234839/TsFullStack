# 数据库 Worker 线程化（透明代理）[[db-worker]]

## 背景

后端用 ZenStack v3（better-sqlite3 同步驱动）+ 自研 RPC。同步 SQLite 会阻塞主线程事件循环（loopLag 诊断的主要来源之一）。目标：把真实数据库客户端挪进 worker_threads，业务代码写法零变化（仍写 `db.user.findFirst(...)`、`db.$transaction(async tx => ...)`、`auth.db`），实际调用经消息 RPC 转发到 Worker。

## 架构 [[db-worker-arch]]

- Worker 侧（`src/Context/dbWorker/workerEntry.ts`）持有 better-sqlite3 + ZenStackClient + SoftDeletePlugin + PolicyPlugin + cost-logger；客户端注册表（base / auth 按 user 缓存派生）；交互式事务（挂起式：`$transaction` 回调内 await 不 settle 的 Promise，主线程 txEnd 时 resolve/reject 触发 commit/rollback）+ 5s 看门狗；驱动层计时（注释 id 认领机制整体迁入）。
- 主线程（`src/Context/dbWorker/DbWorkerClient.ts`）：深度 Proxy 实现 DbClient；拦截 `$setAuth`（惰性派生客户端）、`$transaction`（回调留在主线程，tx 操作带 txId 路由）、`$use`（空操作，插件统一在 Worker 装配）；每条调用的观测记录（耗时/sqlEvents）随响应回传并回灌 ReqCtx（log/sqlEvents/span）。
- 错误跨线程序列化保留 `code`/`meta`，`isZenStackPermissionError`/P2025 判定不受影响。
- 时钟：握手 round-trip 标定两线程 performance.now 原点偏移，诊断时间线换算对齐。
- 构建入口：`vite.config.ts` dist 产物含 `dist/Context/dbWorker/workerEntry.mjs`；开发/测试回退 tsx 拉起源文件；可用 `TSFS_DB_WORKER_FILE` 指定。

## 明确的取舍 [[db-worker-limits]]

- 主线程侧运行时 `$use` 动态注册插件不可用（插件统一在 Worker 装配；业务代码无此用法）
- 事务客户端上不支持嵌套 `$transaction` / `$setAuth` / `$use`
- 并发 RPC 调用的观测记录按时间窗认领，极端交错下可能错归（诊断精度问题，不影响正确性）
- 主进程退出时 Worker 随进程终止（不 unref，worker 存活保持进程存活）
- 开发环境热重启：dev.mjs 的 watch 重建 + 整进程重启天然覆盖（worker 入口在 pack entry 里，随 dist 重建）；worker 直跑 TS 源码不可行——tsx loader 在 worker 内可用但 `.zenstack` 生成物的无扩展名 ESM import 不被回退解析（已探针验证）

## 实现链接

- 实现见 [workerEntry.ts](apps/backend/src/Context/dbWorker/workerEntry.ts)（Worker 侧）
- 实现见 [DbWorkerClient.ts](apps/backend/src/Context/dbWorker/DbWorkerClient.ts)（主线程代理）
- 实现见 [protocol.ts](apps/backend/src/Context/dbWorker/protocol.ts)（消息协议 + 错误序列化）
- 实现见 [DbService.ts](apps/backend/src/Context/DbService.ts)（DbClientEffect 换为代理，业务零改动）
- 实现见 [vite.config.ts](apps/backend/vite.config.ts)（worker 构建入口）

## 验收 [[db-worker-acceptance]]（2026-11-01 已验，验证脚本 [dbworker-verify.ts](apps/backend/test/dbworker-verify.ts)，跑法：`TSFS_DB_WORKER_FILE=$PWD/dist/Context/dbWorker/workerEntry.mjs pnpm tsx test/dbworker-verify.ts`）

- [x] 主线程事件循环：同步慢查询基线冻结 ~430ms → worker 化后 0ms（10 路并发）
- [x] 交互式事务 commit/rollback 正常；并发事务（2 提交 + 1 回滚交错）原子性正确
- [x] 事务看门狗 5s 超时自动回滚，不悬挂，后续客户端可用
- [x] 20 路并发写全部成功且计数一致
- [x] 错误跨线程序列化保真（与直连对照：ORMError + message 完全一致，P2004 时 code/meta 机制就位）
- [ ] 生产链路（鉴权 P2004 → 403 映射、诊断时间线 sqlEvents/driverSql 自洽）待线上验证

### 重要语义（验证中发现）

- 同一客户端在交互式事务挂起期间，其他操作会被排队（单连接事务语义，与 Prisma 一致）：**事务回调内严禁 await 非 tx 的 db 操作**，否则死锁，由 5s 看门狗强制回滚救回。现有 4 处生产事务（dbQueue/accountApi/paymentApi/tokenPackageApi）均只用 tx，无风险
- worker 不可 `unref()`（曾导致脚本场景静默退出）
