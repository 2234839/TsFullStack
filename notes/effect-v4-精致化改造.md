# Effect v4 精致化改造（来源：2026-10-30 四路排查报告）

## effect.layer-trunk [[effect.layer-trunk]]

建立 Layer 主干：`ConfigLive → DbServiceLive → AppLive`，入口收敛为一次 `Effect.provide(main, AppLive)`。

- 后端组装散落在 `apps/backend/src/index.ts`、`apps/backend/src/server/wechat.ts`、`apps/backend/src/server/groupEntry.ts` 多处重复 `Effect.provideService`
- `Context/DbService.ts` 的四个模块级 `let` 手写惰性单例改为 `Layer.effectAcquire`（acquire 建连 / release close）
- `config/loader.ts` 的 `loadAppConfig` 包成 `ConfigLive = Layer.effect(AppConfigService, ...)`
- 顺手消灭两处 `as Effect.Effect<..., never, never>` 强转：`server/webhook.ts:49`、`services/payment/OrderReconciliationService.ts:60`
- `OrderReconciliationService` 的 `let queryRunner` setter 注入改 Tag + Layer

实现见 [AppLive.ts](apps/backend/src/Context/AppLive.ts)、[index.ts](apps/backend/src/index.ts)、[webhook.ts](apps/backend/src/server/webhook.ts)、[OrderReconciliationService.ts](apps/backend/src/services/payment/OrderReconciliationService.ts)

验收：

- [ ] `pact check` 无悬空链
- [ ] `vp run tsc` 通过，全仓 grep 无 `as Effect.Effect<.*never.*never`
- [ ] 入口文件不再出现多份重复 provideService 组装

## effect.tagged-errors [[effect.tagged-errors]]

错误类型 TaggedError 化：`MsgError` 拆成 `Data.TaggedError` 家族，E 通道类型收窄。

- `util/error.ts` 的万能 `MsgError extends Error` 改为 `Data.TaggedError` 体系（保留 op_logout/op_toLogin/op_msgError 语义，可分多个 TaggedError 或在 tag 上区分）
- 事务回调内裸 `throw new Error` 改 typed fail：`services/GroupEntryService.ts:315`、`services/TokenPackageService.ts:129`
- 路由收尾 `runEffect` 不再吞错降级 fallback：`server/wechat.ts`、`server/groupEntry.ts`

实现见 [error.ts](apps/backend/src/util/error.ts)、[server/index.ts](apps/backend/src/server/index.ts)、[GroupEntryService.ts](apps/backend/src/services/GroupEntryService.ts)、[TokenPackageService.ts](apps/backend/src/services/TokenPackageService.ts)。op 字段已按决策移除，序列化契约改为 `kind: _tag`（MsgError/LogoutError/ToLoginError 三个 Tag），前端消费见 [api.ts](apps/website-frontend/src/api.ts)

验收：

- [ ] 全仓存在 `Data.TaggedError` 定义，E 通道不再是裸 `Error`
- [ ] grep 事务回调内无裸 throw new Error

## effect.fiber-timers [[effect.fiber-timers]]

定时任务 Fiber 化：`index.ts` 三个 setInterval → `Effect.repeat(Schedule.fixed)` + forkScoped，删 shutdownTimers 手工簿记。

- `apps/backend/src/index.ts:129`（内存日志）、`:135-147`（代币清理）、`:150-175`（支付对账轮询）
- 优雅关闭段 `shutdownTimers` 数组改为 Effect Scope `addFinalizer`

实现见 [index.ts](apps/backend/src/index.ts)（Fiber.interruptAll 优雅关闭）

验收：

- [ ] index.ts 无 setInterval 管理业务定时任务
- [ ] 优雅关闭仍正常（SIGINT 后在途任务完成再退出）

## effect.cache-module [[effect.cache-module]]

缓存统一 Cache 模块：删除 `util/lruCache.ts`，改用 Effect `Cache` / `Effect.cachedInvalidate`。

- `server/authCache.ts` → `Cache.make({ capacity, timeToLive })`，删 setInterval 清理与 destroyAuthCache
- `Context/AIProxyService.ts:20-22` 手写 TTL → `Effect.cachedInvalidate`
- `OAuth/github.ts` oauthStates、`server/groupEntry.ts:157` 可达性缓存、`lib/SessionAuthSign.ts` CryptoKey 缓存 → Cache 或 Ref 收口
- `middleware/rateLimit.ts` 的 LRU/清理部分用 Cache 简化（限流语义保留）

实现见 [authCache.ts](apps/backend/src/server/authCache.ts)、[AIProxyService.ts](apps/backend/src/Context/AIProxyService.ts)（cachedModels → Cache.make，Effect.ignore → Effect.catch 记日志）、[SessionAuthSign.ts](apps/backend/src/lib/SessionAuthSign.ts)（无界 Map → 有界 Cache，修复按 sessionToken 无限增长风险）、[groupEntry.ts](apps/backend/src/server/groupEntry.ts)（可达性 Map → Cache.make）。`util/lruCache.ts` 及其测试已删除。

保留手写实现（评估后结论，非 Cache 适用场景）：

- `OAuth/github.ts` oauthStates：一次性消费语义（读到即删）+ 容量上限，Cache 的并发单飞与不删除语义不匹配
- `middleware/rateLimit.ts`：计数值需原地递增，Cache 缓存不可变值，强改会引入不必要的 copy

验收：

- [ ] `util/lruCache.ts` 已删除且无引用
- [ ] authCache 无 setInterval/destroy 簿记

## effect.queue-lock-renewal [[effect.queue-lock-renewal]]

自研 DB 队列锁续期修复 + PersistedQueue 迁移评估。

- 短期：修复 `util/dbQueue.ts` 无锁续期问题（>60s 任务会被误判 stuck 被其他实例重复执行）——心跳续期或调大 stuckTimeoutMs 按任务时长
- 评估：Effect v4 PersistedQueue 迁移可行性（SQL store 是否支持 SQLite、优先级/结果留痕缺口），结论写入 doc/*.md
- 迁移时必须保留的业务逻辑：`TokenGrantService.grantOnce`、事务内 nextGrantDate 推 2099 的幂等占位、周期调度语义

实现见 [dbQueue.ts](apps/backend/src/util/dbQueue.ts)（STUCK_TIMEOUT 放宽为 3× 心跳间隔）、[persistedqueue-迁移评估.md](doc/persistedqueue-迁移评估.md)（结论：暂不迁移，保留验收清单）

验收：

- [ ] 长任务不再被 stuck 监控误杀重复执行（代码层有续期逻辑）
- [ ] PersistedQueue 迁移评估结论落 doc/*.md

## effect.api-style-unify [[effect.api-style-unify]]

API 风格统一与零散收尾（低优先级）。

- `api/authApi/*.ts` 残留 34 处 `.pipe(Effect.andThen)` 老风格统一为 `Effect.gen`
- `services/GroupEntryService.ts` recordStat/notifyUpload 的 fire-and-forget 改 `Effect.runFork`，不在服务内部 provide
- `Context/AIProxyService.ts` 的 `Effect.ignore` 吞错改 `Effect.catchAll` 记日志
- `services/payment/adapters/*` 的 `fetch().then(r => r.json())` 单 catch 拆分网络/HTTP/JSON 错误
- `TokenPricingCalculator` 硬编码价格迁入配置 Tag

实现见 [groupEntryApi.ts](apps/backend/src/api/authApi/groupEntryApi.ts)、[tokenPackageApi.ts](apps/backend/src/api/authApi/tokenPackageApi.ts)、[paymentApi.ts](apps/backend/src/api/authApi/paymentApi.ts)、[taskApi.ts](apps/backend/src/api/authApi/taskApi.ts)（andThen 全部转 gen，全仓 grep = 0）；[GroupEntryService.ts](apps/backend/src/services/GroupEntryService.ts) recordStat/notifyUpload 改返回 Effect，调用方 [groupEntry.ts](apps/backend/src/server/groupEntry.ts) forkEffect + runFork；[AIProxyService.ts](apps/backend/src/Context/AIProxyService.ts) Effect.ignore → Effect.catch 记日志；[fetchJson.ts](apps/backend/src/services/payment/adapters/fetchJson.ts) 网络/HTTP/JSON 三类错误拆分；[PricingConfig.ts](apps/backend/src/Context/PricingConfig.ts) + [TokenPricingCalculator.ts](apps/backend/src/services/TokenPricingCalculator.ts) 定价迁入配置 Tag（AppLive 已挂 PricingConfigLive）

验收：

- [ ] api/authApi 下无 Effect.andThen 老风格
- [ ] 无静默 Effect.ignore（埋点失败至少 logWarning）

## effect.wechat-service-v4 [[effect.wechat-service-v4]]

WechatService Effect v4 化：三个手写 TTL 缓存改 Cache.make，补 fetch 超时与错误拆分。

- `tokenCache`（access_token）→ `Cache.make` 并发单飞，避免 token 过期瞬间并发重取
- `mediaCache`（临时素材 media_id）→ `Cache.make`（24h TTL）
- `replyCache`（微信 5s 超时重试去重）→ `Cache.make` + 20s TTL，删手工 500 条清理循环
- 修复隐藏 bug：`getAccessToken` 的 `await fetch(url)` 无超时信号，补 `withFetchTimeout`
- fetch().json() 拆分网络/HTTP/JSON 错误（复用统一 fetchJson 工具）

实现见 [WechatService.ts](apps/backend/src/services/WechatService.ts)：三个缓存改 `Cache.make`（并发单飞 + TTL 自动失效），lookup 额外参数走伴生注册表；getAccessToken 补 `withFetchTimeout` 修复无超时隐藏 bug；出站请求走 `util/fetchJson.ts` 三类错误拆分。对外 Promise API 签名不变，调用方无感知

验收：

- [ ] WechatService 无手写 Map TTL 缓存与手工清理循环
- [ ] 所有出站 fetch 带超时信号

## effect.token-cleanup-v4 [[effect.token-cleanup-v4]]

TokenCleanupService 改 Effect：其「运行在非 Effect 上下文」的前提已不成立（index.ts 定时任务已 Fiber 化）。

- 纯 async 分批清理改 `Effect.gen` + `dbTry`，错误进 E 通道
- `Promise.all` 三路删除改 `Effect.all`
- 调用方（index.ts memoryLogLoop 等）适配

实现见 [TokenCleanupService.ts](apps/backend/src/services/TokenCleanupService.ts)（Effect.gen + tryOrFail + Effect.all 并行）与 [index.ts](apps/backend/src/index.ts) 调用点适配

验收：

- [ ] TokenCleanupService 返回 Effect.Effect，无裸 try/catch 吞错

## effect.fetchjson-common [[effect.fetchjson-common]]

fetchJson 三类错误拆分工具上移共用 + infoQuality 接入。

- `services/payment/adapters/fetchJson.ts` 上移到 `util/fetchJson.ts`，支付适配器改引新路径
- `api/AiApi/infoQuality.ts` 的 `callOllamaAPI` 接入（当前 JSON 解析失败会裸抛 SyntaxError）

实现见 [util/fetchJson.ts](apps/backend/src/util/fetchJson.ts)（原 `adapters/fetchJson.ts` 上移为 `fetchJsonOrThrow`，旧文件已删）、[afdian.adapter.ts](apps/backend/src/services/payment/adapters/afdian.adapter.ts)、[mbd.adapter.ts](apps/backend/src/services/payment/adapters/mbd.adapter.ts)、[infoQuality.ts](apps/backend/src/api/AiApi/infoQuality.ts)

验收：

- [ ] 全仓出站 fetch+json 均走统一工具，无裸 response.json()

## API 慢请求诊断机制 [[effect.diag-trace]]

诊断 API 卡顿：慢请求（总耗时>500ms / 单条 SQL>100ms / 事件循环卡顿>50ms 任一命中）落盘 SQLite `DiagTrace` 表，含结构化阶段时间线（排队/鉴权/RPC/SQL 明细）与 `loopLagMaxMs` 硬阻塞判据（better-sqlite3 同步执行会冻结事件循环，lag≈sqlMax=硬阻塞；lag≈0 但耗时长=外部 IO 等待）。管理端查询接口 `diagApi.listTraces/getTrace/getOverview`（近 24h 慢因聚合 + 最慢接口排行 + 事件循环健康）。

实现见 [LoopLagMonitor.ts](apps/backend/src/util/LoopLagMonitor.ts)、[ReqCtx.ts](apps/backend/src/Context/ReqCtx.ts)、[DbService.ts](apps/backend/src/Context/DbService.ts)、[server/index.ts](apps/backend/src/server/index.ts)、[diagApi.ts](apps/backend/src/api/authApi/diagApi.ts)

### 验收

- 慢请求自动落盘 DiagTrace，正常请求零写入
- timeline 能定位卡顿阶段（queue/auth/rpc/sql 逐条）
- loopLagMaxMs 能区分硬阻塞与事件等待
- diagApi 管理员可查询总览与明细
