/**
 * 决定性实验：真实 worker 会话路径的每查询 ms（worker 侧 cost-logger 上报值）
 */
process.env.TSFS_DB_WORKER_FILE = new URL('../dist/Context/dbWorker/workerEntry.mjs', import.meta.url).pathname;
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDbWorker } from '../src/Context/dbWorker/DbWorkerClient';

const dbPath = join(mkdtempSync(join(tmpdir(), 'w-')), 't.db');
copyFileSync(join(import.meta.dirname, '../backup/dev-20261031-150440.db'), dbPath);
const session = await getDbWorker(dbPath);

const raw = await import('better-sqlite3');
const r = new (raw.default as new (p: string) => unknown)(dbPath) as {
  prepare: (s: string) => { get: (...a: unknown[]) => { userId: string } };
};
const { userId } = r.prepare(`SELECT "userId" FROM "UserSession" WHERE "userId" IS NOT NULL LIMIT 1`).get();

const clientId = await session.createAuthClient({ userId });

const N = 300;
const args = [{ where: { id: userId }, select: { id: true, email: true } }];
// 预热
for (let i = 0; i < 20; i++) await session.call(clientId, undefined, 'user.findFirst', args);

const msList: number[] = [];
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const { events } = await session.call(clientId, undefined, 'user.findFirst', args);
  msList.push(events?.[0]?.ms ?? -1);
}
const avg = (performance.now() - t0) / N;
msList.sort((a, b) => a - b);
const p = (q: number) => msList[Math.floor(msList.length * q)];
console.log(
  `worker 往返 avg=${avg.toFixed(3)}ms  worker上报ms: p50=${p(0.5).toFixed(2)} p90=${p(0.9).toFixed(2)} p99=${p(0.99).toFixed(2)} max=${msList.at(-1)!.toFixed(2)}`,
);

// 并发版（20 路）：worker 线程排队时上报 ms 是否被放大
{
  const all: number[] = [];
  await Promise.all(
    Array.from({ length: 20 }, async () => {
      for (let i = 0; i < 15; i++) {
        const { events } = await session.call(clientId, undefined, 'user.findFirst', args);
        if (events?.[0]) all.push(events[0].ms);
      }
    }),
  );
  all.sort((a, b) => a - b);
  console.log(
    `并发20路: worker上报ms p50=${all[Math.floor(all.length * 0.5)].toFixed(2)} p90=${all[Math.floor(all.length * 0.9)].toFixed(2)} max=${all.at(-1)!.toFixed(2)}`,
  );
}
process.exit(0);
