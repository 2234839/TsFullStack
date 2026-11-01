/**
 * worker vs 直连性能对比：单调用延迟（序列化/跨线程开销）+ 并发吞吐 + 事件循环滞后
 */
process.env.TSFS_DB_WORKER_FILE = new URL('../dist/Context/dbWorker/workerEntry.mjs', import.meta.url).pathname;
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getLocalDbClient } from '../src/Context/dbWorker/localDb';
import { getDbWorker } from '../src/Context/dbWorker/DbWorkerClient';

const dbPath = join(mkdtempSync(join(tmpdir(), 'perf-')), 't.db');
copyFileSync(join(import.meta.dirname, '../backup/dev-20261031-150440.db'), dbPath);
const local = getLocalDbClient(dbPath);
const session = await getDbWorker(dbPath);
const worker = session.proxyFor('base');

/** 事件循环滞后采样器 */
function startLagSampler() {
  let maxLag = 0;
  let stop = false;
  const tick = () => {
    if (stop) return;
    const t0 = performance.now();
    setTimeout(() => {
      maxLag = Math.max(maxLag, performance.now() - t0 - 1);
      tick();
    }, 5);
  };
  tick();
  return {
    stop: () => {
      stop = true;
      return maxLag;
    },
  };
}

const N = 300;
// 1. 串行小查询延迟
{
  await local.user.findFirst({ where: { id: 'x' } });
  await worker.user.findFirst({ where: { id: 'x' } });
  let t0 = performance.now();
  for (let i = 0; i < N; i++) await local.user.findFirst({ where: { id: 'x' }, select: { id: true } });
  const localMs = (performance.now() - t0) / N;
  t0 = performance.now();
  for (let i = 0; i < N; i++) await worker.user.findFirst({ where: { id: 'x' }, select: { id: true } });
  const workerMs = (performance.now() - t0) / N;
  console.log(
    `[串行小查询] 直连=${localMs.toFixed(3)}ms/次  worker=${workerMs.toFixed(3)}ms/次  开销=+${(workerMs - localMs).toFixed(3)}ms`,
  );
}
// 2. 大结果集（100行）传输开销
{
  let t0 = performance.now();
  for (let i = 0; i < 50; i++) await local.user.findMany({ take: 100 });
  const localMs = (performance.now() - t0) / 50;
  t0 = performance.now();
  for (let i = 0; i < 50; i++) await worker.user.findMany({ take: 100 });
  const workerMs = (performance.now() - t0) / 50;
  console.log(`[大结果集100行] 直连=${localMs.toFixed(3)}ms/次  worker=${workerMs.toFixed(3)}ms/次`);
}
// 3. 并发 20 路 × 30 次（吞吐 + 主线程滞后）
{
  for (const [name, db] of [
    ['直连', local],
    ['worker', worker],
  ] as const) {
    const lag = startLagSampler();
    const t0 = performance.now();
    await Promise.all(
      Array.from({ length: 20 }, () =>
        (async () => {
          for (let i = 0; i < 30; i++) await db.user.findMany({ take: 5 });
        })(),
      ),
    );
    const total = performance.now() - t0;
    const maxLag = lag.stop();
    console.log(
      `[并发20路×30次] ${name}: 总耗时=${total.toFixed(0)}ms  平均=${(total / 600).toFixed(3)}ms/次  主线程最大滞后=${maxLag.toFixed(1)}ms`,
    );
  }
}
// 4. 慢查询场景（全表扫描大表）下主线程健康度
{
  for (const [name, db] of [
    ['直连', local],
    ['worker', worker],
  ] as const) {
    const lag = startLagSampler();
    const t0 = performance.now();
    await Promise.all(Array.from({ length: 5 }, () => db.content.findMany({ take: 5000 })));
    const total = performance.now() - t0;
    const maxLag = lag.stop();
    console.log(`[重查询5路×5000行] ${name}: 总耗时=${total.toFixed(0)}ms  主线程最大滞后=${maxLag.toFixed(1)}ms`);
  }
}
process.exit(0);
