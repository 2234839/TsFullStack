/**
 * dbWorker 运行时验证脚本（临时，不提交）：
 * 1. 主线程事件循环阻塞对比：主线程同步 better-sqlite3 慢查询 vs worker 化慢查询
 * 2. 交互式事务 commit/rollback、并发事务隔离、并发读写一致性
 */
import Database from 'better-sqlite3';
import { getDbWorker } from '../src/Context/dbWorker/DbWorkerClient';
import { isZenStackPermissionError, isZenStackValidationError } from '../src/util/zenstack-error';

const DB_PATH = '/tmp/dbworker-verify.db';
import { copyFileSync, existsSync, rmSync } from 'node:fs';
if (existsSync(DB_PATH)) rmSync(DB_PATH);
copyFileSync('/home/gs/opensource_code/TsFullStack/apps/backend/backup/dev-20261031-150440.db', DB_PATH);

/** 慢查询 SQL：递归 CTE 制造 ~几十 ms 的同步执行 */
const SLOW_SQL = 'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c WHERE x<400000) SELECT count(*) FROM c';

/** 主线程事件循环卡顿监测器：5ms 心跳，统计超过阈值的延迟 */
function startLagMonitor() {
  const samples: { at: number; lag: number }[] = [];
  let last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    const lag = now - last - 5;
    if (lag > 10) samples.push({ at: now, lag: Math.round(lag) });
    last = now;
  }, 5);
  return {
    stop: () => {
      clearInterval(timer);
      return samples;
    },
    samples,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 验证 1：主线程事件循环
// ---------------------------------------------------------------------------

async function verifyLoopLag() {
  console.log('=== 验证 1：主线程事件循环阻塞 ===');
  // 基线 A：主线程直连 better-sqlite3 同步慢查询 x10
  {
    const raw = new Database(DB_PATH, { readonly: true });
    const stmt = raw.prepare(SLOW_SQL);
    stmt.get(); // 预热
    const mon = startLagMonitor();
    for (let i = 0; i < 10; i++) stmt.get();
    await sleep(100);
    const samples = mon.stop();
    const total = samples.reduce((s, x) => s + x.lag, 0);
    const max = samples.reduce((m, x) => Math.max(m, x.lag), 0);
    console.log(`[基线·主线程同步] 卡顿样本=${samples.length} 总冻结=${Math.round(total)}ms 最大=${max}ms`);
    raw.close();
  }
  // 场景 B：worker 化慢查询 x10（并发）
  {
    const session = await getDbWorker(DB_PATH);
    const db = session.proxyFor('base');
    await db.$queryRawUnsafe(SLOW_SQL);
    const mon = startLagMonitor();
    await Promise.all(Array.from({ length: 10 }, () => db.$queryRawUnsafe(SLOW_SQL)));
    await sleep(100);
    const samples = mon.stop();
    const total = samples.reduce((s, x) => s + x.lag, 0);
    const max = samples.reduce((m, x) => Math.max(m, x.lag), 0);
    console.log(`[worker 化·并发10] 卡顿样本=${samples.length} 总冻结=${Math.round(total)}ms 最大=${max}ms`);
  }
}

// ---------------------------------------------------------------------------
// 验证 2：事务与并发
// ---------------------------------------------------------------------------

async function verifyTransactionAndConcurrency() {
  console.log('=== 验证 2：事务与并发 ===');
  const session = await getDbWorker(DB_PATH);
  const db = session.proxyFor('base');
  const mark = `dbworker-verify-${Date.now()}`;

  // 清场
  await db.diagTrace.deleteMany({ where: { method: { startsWith: 'dbworker-verify-' } } });

  // 2.1 事务 commit
  {
    const n = await db.$transaction(async (tx: typeof db) => {
      await tx.diagTrace.create({ data: { method: `${mark}-tx-commit`, totalMs: 1, queueWaitMs: 0 } });
      const cnt = await tx.diagTrace.count({ where: { method: { startsWith: `${mark}-tx-commit` } } });
      return cnt;
    });
    const after = await db.diagTrace.count({ where: { method: { startsWith: `${mark}-tx-commit` } } });
    console.log(`[2.1 事务commit] 事务内可见=${n} 提交后可见=${after} ${n === 1 && after === 1 ? '✅' : '❌'}`);
  }

  // 2.2 事务 rollback
  {
    let rolledOut = false;
    try {
      await db.$transaction(async (tx: typeof db) => {
        await tx.diagTrace.create({ data: { method: `${mark}-tx-rollback`, totalMs: 1, queueWaitMs: 0 } });
        throw new Error('业务抛错，应回滚');
      });
    } catch (e) {
      rolledOut = (e as Error).message === '业务抛错，应回滚';
    }
    const after = await db.diagTrace.count({ where: { method: { startsWith: `${mark}-tx-rollback` } } });
    console.log(`[2.2 事务rollback] 错误透传=${rolledOut} 残留行=${after} ${rolledOut && after === 0 ? '✅' : '❌'}`);
  }

  // 2.3 并发事务：两个事务同时挂起提交，验证排队执行、各自原子生效
  //    （注意语义：同客户端在交互式事务挂起期间，其他操作会被排队——与 Prisma 单连接事务一致，
  //     因此事务回调内严禁 await 非 tx 的 db 操作，否则死锁由 5s 看门狗救回）
  {
    const mkTx = (tag: string, rollback: boolean) =>
      db.$transaction(async (tx: typeof db) => {
        await tx.diagTrace.create({ data: { method: `${mark}-iso-${tag}`, totalMs: 1, queueWaitMs: 0 } });
        if (rollback) throw new Error(`${tag}-rollback`);
      });
    const results = await Promise.allSettled([mkTx('a', false), mkTx('b', true), mkTx('c', false)]);
    const okA = results[0]?.status === 'fulfilled';
    const okB = results[1]?.status === 'rejected' && (results[1].reason as Error).message === 'b-rollback';
    const okC = results[2]?.status === 'fulfilled';
    const cntA = await db.diagTrace.count({ where: { method: `${mark}-iso-a` } });
    const cntB = await db.diagTrace.count({ where: { method: `${mark}-iso-b` } });
    const cntC = await db.diagTrace.count({ where: { method: `${mark}-iso-c` } });
    console.log(
      `[2.3 并发事务] 提交a=${okA} 回滚b=${okB} 提交c=${okC} 落库a/b/c=${cntA}/${cntB}/${cntC} ${okA && okB && okC && cntA === 1 && cntB === 0 && cntC === 1 ? '✅' : '❌'}`,
    );
  }

  // 2.4 事务看门狗：直接在 session 层 begin 后不 commit，验证 5s 超时自动回滚、不悬挂、后续客户端可用
  {
    const txId = await session.txBegin('base');
    // 不发 txEnd，等看门狗（5s）自动回滚
    await sleep(6200);
    // 后续操作应正常（事务已回收，客户端不悬挂）
    const okAfter = await db.diagTrace.count({ where: { method: { startsWith: `${mark}-watchdog` } } });
    let txEndErr = '';
    try {
      await session.txEnd(txId, true);
    } catch (e) {
      txEndErr = (e as Error).message.slice(0, 30);
    }
    console.log(
      `[2.4 看门狗超时回滚] 超时后txEnd报错含不存在=${txEndErr.includes('不存在')} 后续客户端可用=${okAfter === 0} ${txEndErr.includes('不存在') && okAfter === 0 ? '✅' : '❌'}`,
    );
  }

  // 2.5 并发读写一致性：20 路并发 create + deleteMany 清理
  {
    const before = await db.diagTrace.count({ where: { method: { startsWith: `${mark}-rw` } } });
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        db.diagTrace.create({ data: { method: `${mark}-rw-${i}`, totalMs: i, queueWaitMs: 0 } }),
      ),
    );
    const okCount = results.filter((r) => r.status === 'fulfilled').length;
    const after = await db.diagTrace.count({ where: { method: { startsWith: `${mark}-rw` } } });
    console.log(
      `[2.5 并发写20路] 成功=${okCount} 计数=${after} 之前=${before} ${okCount === 20 && after - before === 20 ? '✅' : '❌'}`,
    );
  }

  // 2.6 错误跨线程序列化：权限错误/校验错误形态（用违反 schema 的字段触发校验错误，验证 code/meta 还原）
  {
    let err: unknown;
    try {
      // totalMs 传字符串触发 zod 校验失败（P2004 DATA_VALIDATION_VIOLATION）
      await db.diagTrace.create({ data: { method: 'x', totalMs: 'not-a-number' as never, queueWaitMs: 0 } });
    } catch (e) {
      err = e;
    }
    const rec = err as Record<string, unknown>;
    const errObj = err as Error;
    console.log(
      `[2.6 错误序列化] constructor=${errObj?.constructor?.name} code=${String(rec?.['code'])} hasMeta=${rec?.['meta'] != null} message=${errObj?.message?.slice(0, 80)}`,
    );
    console.log(`[2.6 判定] 权限错误=${isZenStackPermissionError(err)} 校验错误=${isZenStackValidationError(err)}`);
  }

  // 清场
  await db.diagTrace.deleteMany({ where: { method: { startsWith: 'dbworker-verify-' } } });
}

verifyLoopLag()
  .then(verifyTransactionAndConcurrency)
  .then(() => {
    console.log('验证完成');
    process.exit(0);
  })
  .catch((e) => {
    console.error('验证脚本失败:', e);
    process.exit(1);
  });
