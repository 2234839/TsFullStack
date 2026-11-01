/**
 * ORM 包装开销分层剖析：逐层计时定位 ZenStack 每条查询 ~9ms 开销的归属
 * 层级：raw better-sqlite3 → ZenStack base(SoftDelete) → +PolicyPlugin → +$setAuth → +costLogger
 */
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';
import { createBaseClient, createDriverTimingEngine, deriveAuthClient } from '../src/Context/dbWorker/dbCore';

const dbPath = join(mkdtempSync(join(tmpdir(), 'orm-bench-')), 't.db');
copyFileSync(join(import.meta.dirname, '../backup/dev-20261031-150440.db'), dbPath);

/** 已知存在的用户 id（backup 库里抓一条真实 session 对应的用户） */
const raw = new Database(dbPath, { readonly: true });
const { userId } = raw.prepare(`SELECT "userId" FROM "UserSession" WHERE "userId" IS NOT NULL LIMIT 1`).get() as {
  userId: string;
};
raw.close();

const N = 500;
async function bench(name: string, fn: () => Promise<unknown>, args?: unknown): Promise<void> {
  // 预热（触发 zod/策略/prepare 缓存）
  for (let i = 0; i < 20; i++) await fn();
  const t0 = performance.now();
  for (let i = 0; i < N; i++) await fn();
  const ms = (performance.now() - t0) / N;
  console.log(`${name.padEnd(38)} ${ms.toFixed(3)} ms/次${args ? '' : ''}`);
}

const where = { id: userId } as const;
const args = { where, select: { id: true, email: true } } as const;

// 层 0：裸驱动（prepare 语句复用，即理想下界）
{
  const db = new Database(dbPath, { readonly: true });
  const stmt = db.prepare(`SELECT "id","email" FROM "User" WHERE "id" = ?`);
  await bench('L0 raw sqlite (stmt复用)', async () => stmt.get(userId));
  const db2 = new Database(dbPath, { readonly: true });
  await bench('L0b raw sqlite (每次prepare)', async () =>
    db2.prepare(`SELECT "id","email" FROM "User" WHERE "id" = ?`).get(userId));
  db.close();
  db2.close();
}

const engine = createDriverTimingEngine();
const { client: base } = createBaseClient(engine, dbPath);
await bench('L1 ZenStack base(SoftDelete)', () => base.user.findFirst(args as never));

const withPolicy = base.$use(new PolicyPlugin());
await bench('L2 +PolicyPlugin(未setAuth)', () => withPolicy.user.findFirst(args as never));

const authed = deriveAuthClient(base, { userId });
await bench('L3 +$setAuth(共享validator)', () => authed.user.findFirst(args as never));

// 对照组：不共享 validator 的派生（验证 shareInputValidator 是否真的生效）
{
  const noShare = base.$use(new PolicyPlugin()).$setAuth({ userId } as never);
  await bench('L3b +$setAuth(不共享validator)', () => noShare.user.findFirst(args as never));
}

// findMany 100 行对比（结果序列化占比）
await bench('L3 findMany take:100', () => authed.user.findMany({ take: 100 } as never));
await bench('L1 findMany take:100', () => base.user.findMany({ take: 100 } as never));

// 无 where 的 count（校验参数最简）
await bench('L3 user.count', () => authed.user.count());

// L4：挂上真实 cost-logger（worker 侧同款：无 wrapProceed，onResult 空转）
{
  const { makeCostLoggerPlugin } = await import('../src/Context/dbWorker/dbCore');
  const logged = base.$use(makeCostLoggerPlugin(engine, { onResult: () => {} }));
  const loggedAuthed = deriveAuthClient(logged as never, { userId });
  await bench('L4 +costLogger(onResult空转)', () => loggedAuthed.user.findFirst(args as never));
}

// 多形状轮换（模拟线上：每个请求的 where/select 形状都不同，验证 zod/策略缓存是否按形状失效）
{
  const shapes = [
    () => authed.user.findFirst({ where: { id: userId } } as never),
    () => authed.user.findFirst({ where: { id: userId }, select: { id: true } } as never),
    () => authed.user.findFirst({ where: { id: userId }, select: { id: true, email: true } } as never),
    () => authed.user.findMany({ where: { id: userId } } as never),
    () => authed.user.findMany({ take: 5, orderBy: { created: 'desc' as const } } as never),
    () => authed.user.count({ where: { id: userId } } as never),
    () => authed.userSession.findFirst({ where: { userId } } as never),
    () => authed.userSession.findMany({ where: { userId }, take: 2 } as never),
    () => authed.role.findMany({} as never),
    () => authed.post.findMany({ take: 3 } as never),
  ];
  // 预热一轮全部形状
  for (const s of shapes) await s();
  const perCall: number[] = [];
  for (let i = 0; i < 300; i++) {
    const s = shapes[i % shapes.length];
    const t0 = performance.now();
    await s();
    perCall.push(performance.now() - t0);
  }
  perCall.sort((a, b) => a - b);
  const avg = perCall.reduce((s, v) => s + v, 0) / perCall.length;
  const p = (q: number) => perCall[Math.floor(perCall.length * q)].toFixed(2);
  console.log(
    `多形状轮换 avg=${avg.toFixed(2)}ms  p50=${p(0.5)}  p90=${p(0.9)}  p99=${p(0.99)}  max=${perCall.at(-1)!.toFixed(2)}`,
  );
  // 每个形状的平均
  const shapeAvg = Array.from({ length: shapes.length }, () => [0, 0]);
  perCall.forEach((ms, i) => {
    shapeAvg[i % shapes.length][0] += ms;
    shapeAvg[i % shapes.length][1]++;
  });
  const shapeNames = [
    'findFirst(where)',
    'findFirst(select1)',
    'findFirst(select2)',
    'findMany(where)',
    'findMany(orderBy)',
    'count(where)',
    'userSession.findFirst',
    'userSession.findMany',
    'role.findMany',
    'post.findMany',
  ];
  shapeAvg.forEach(([sum, n], i) =>
    console.log(`  形状[${i}] ${shapeNames[i].padEnd(22)} avg=${(sum / n).toFixed(2)}ms`),
  );
}
