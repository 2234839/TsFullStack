# Effect v4 PersistedQueue 迁移评估（对应需求块 effect.queue-lock-renewal）

## 现状

`apps/backend/src/util/dbQueue.ts` 自研 PrismaQueue：SQLite `queue` 表 + 轮询抢占（事务内 `findFirst` + `updateMany` 条件更新）+ 心跳续期 + stuck 监控重派 + 指数退避重试。

## 效果层修复（已落地）

- 心跳续期已存在：`startHeartbeat` 每 30s 刷新本实例全部 PROCESSING 任务的 `updated`，stuck 监控按 `updated < now - stuckTimeoutMs` 判定，不会误杀健康长任务
- 误判的真实风险是「心跳写库失败被吞且不重试」：原 STUCK_TIMEOUT(60s) 仅为心跳间隔(30s)的 2 倍，连续两次心跳失败即误判。已放宽为 90s（3 倍余量）
- 双重执行的完成侧防线已有：`processTask` 完成时 `updateMany where workerId + status: PROCESSING`，被重派后的旧 worker 完成写入是 no-op。剩余风险仅限 handler 副作用本身重复（幂等需 handler 自担，如 `TokenGrantService.grantOnce` 已做幂等占位）

## PersistedQueue 迁移评估

### 契合点

- 持久化、at-least-once 投递、重试/退避：与现实现目标一致
- Effect 原生：任务处理程序直接是 `Effect`，与后端 Effect 主干（AppLive / Tag）天然组合，省去 Promise↔Effect 边界

### 缺口 / 风险

1. **存储后端**：PersistedQueue 的 SQL store 面向 Postgres 等；SQLite 方言支持与迁移脚本需验证，本项目线上库是单文件 SQLite
2. **多实例并发抢占**：现实现靠 DB 行级条件更新保证只被一个实例认领；PersistedQueue 的多消费者语义在 SQLite（无 `FOR UPDATE SKIP LOCKED`）下的正确性需实测
3. **优先级**：现有 `priority desc, created asc` 排序语义需在 PersistedQueue 配置中等价复现
4. **结果留痕**：业务侧依赖 `queue.result` 字段（前端可查任务产物）；PersistedQueue 的结果查询能力需映射
5. **迁移成本**：`schema.zmodel` 的 Queue 模型、心跳/stuck 监控代码、`register/add` 调用点全部重写

### 结论

**暂不迁移**。当前 PrismaQueue 经过锁续期修复后语义完整、体量小（<400 行）、SQLite 下已验证可用；PersistedQueue 在 SQLite + 多实例场景的正确性未证实，且优先级/结果留痕需要额外适配层。建议 PersistedQueue 的 SQLite 支持成熟后（或项目切换 Postgres 时）重新评估，届时上述「必须保留的业务逻辑」作为验收清单：

- `TokenGrantService.grantOnce` 的幂等占位（事务内 nextGrantDate 推 2099）
- 周期调度语义（PENDING + runAt 轮询）
- `priority desc, created asc` 出队顺序
- 任务结果留痕可查询
