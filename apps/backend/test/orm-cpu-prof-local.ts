/**
 * CPU profile 压测（直连模式）：并发混合查询跑在当前线程，ORM 栈帧完整可采样
 */
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getLocalDbClient } from '../src/Context/dbWorker/localDb';

const dbPath = join(mkdtempSync(join(tmpdir(), 'cpu2-')), 't.db');
copyFileSync(join(import.meta.dirname, '../backup/dev-20261031-150440.db'), dbPath);
const base = getLocalDbClient(dbPath);
const Database = (await import('better-sqlite3')).default;
const r = new Database(dbPath, { readonly: true });
const { userId } = r.prepare(`SELECT "userId" FROM "UserSession" WHERE "userId" IS NOT NULL LIMIT 1`).get() as {
  userId: string;
};
r.close();
const { deriveLocalAuthClient } = await import('../src/Context/dbWorker/localDb');
const db = deriveLocalAuthClient(dbPath, { userId });

const calls: Array<() => Promise<unknown>> = [
  () => db.user.findFirst({ where: { id: userId }, select: { id: true, email: true } }),
  () => db.user.findMany({ take: 5 }),
  () => db.userSession.findFirst({ where: { userId } }),
  () => db.user.count(),
  () => db.role.findMany(),
];

/** 预热（zod 首编译移出采样窗） */
for (const c of calls) await c();

console.log('begin profiling window');
const t0 = performance.now();
let n = 0;
await Promise.all(
  Array.from({ length: 20 }, async () => {
    for (let i = 0; i < 300; i++) {
      await calls[n++ % calls.length]!();
    }
  }),
);
console.log(`end profiling window: 6000 calls in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
