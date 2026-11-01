/**
 * CPU profile 压测：worker 路径并发混合查询，配合 node --cpu-prof 抓火焰数据
 */
process.env.TSFS_DB_WORKER_FILE = new URL('../dist/Context/dbWorker/workerEntry.mjs', import.meta.url).pathname;
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDbWorker } from '../src/Context/dbWorker/DbWorkerClient';

const dbPath = join(mkdtempSync(join(tmpdir(), 'cpu-')), 't.db');
copyFileSync(join(import.meta.dirname, '../backup/dev-20261031-150440.db'), dbPath);
const session = await getDbWorker(dbPath);

const Database = (await import('better-sqlite3')).default;
const r = new Database(dbPath, { readonly: true });
const { userId } = r.prepare(`SELECT "userId" FROM "UserSession" WHERE "userId" IS NOT NULL LIMIT 1`).get() as {
  userId: string;
};
r.close();
const clientId = await session.createAuthClient({ userId });

const calls: Array<[string, unknown[]]> = [
  ['user.findFirst', [{ where: { id: userId }, select: { id: true, email: true } }]],
  ['user.findMany', [{ take: 5 }]],
  ['userSession.findFirst', [{ where: { userId } }]],
  ['user.count', [{}]],
  ['role.findMany', [{}]],
];

/** 预热（含 zod 首编译，避免污染 profile） */
for (const [m, a] of calls) await session.call(clientId, undefined, m, a);

console.log('begin profiling window');
/** 并发 20 路 × 每路 300 次（约 6000 次调用，摊薄启动期编译噪声） */
await Promise.all(
  Array.from({ length: 20 }, async () => {
    for (let i = 0; i < 300; i++) {
      const [m, a] = calls[i % calls.length];
      await session.call(clientId, undefined, m, a);
    }
  }),
);
console.log('end profiling window');
/** 收尾：terminate 触发 worker 线程退出并落盘其 profile，再退出主进程 */
session.terminate();
await new Promise((r) => setTimeout(r, 1000));
process.exit(0);
