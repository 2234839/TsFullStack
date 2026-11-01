/**
 * 包装层开销定位基准（一次性诊断脚本，跑完可删）：
 * 同一条 findUnique 分别在 基座客户端 / 带权限客户端 上跑热，
 * 拆出 ORM 包装开销 vs 驱动真实执行，再对比第 1 次与热态的差值（冷启动占比）。
 */
import Database from 'better-sqlite3';
import { performance } from 'node:perf_hooks';

const dbPath = process.argv[2] ?? 'prisma/dev.db';

const { createBaseClient, createDriverTimingEngine, deriveAuthClient } =
  await import('./dist/dbCore-Cu40JmUZ.mjs').catch(async () => {
    // dist 分块名会变，回退到 tsx 直跑源码
    return import('./src/Context/dbWorker/dbCore.ts');
  });

const engine = createDriverTimingEngine();
const { client: base } = createBaseClient(engine as any, dbPath);

/** 先拿一个真实用户 */
const seed = (await base.user.findMany({
  take: 2,
} as any)) as Array<Record<string, unknown>>;
const user = seed[0];
if (!user) throw new Error('库里没有用户，没法 bench');
const userId = user.id as string;

const authed = deriveAuthClient(base as any, user as any);

async function bench(label: string, fn: () => Promise<unknown>, n = 2000) {
  /** 冷态第 1 次 */
  const coldStart = performance.now();
  const coldExec = await engine.claim(fn);
  const coldMs = performance.now() - coldStart;

  const totals: number[] = [];
  const execs: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const e = await engine.claim(fn);
    totals.push(performance.now() - t0);
    execs.push(e.totalMs);
  }
  totals.sort((a, b) => a - b);
  execs.sort((a, b) => a - b);
  const p = (arr: number[], q: number) => arr[Math.floor(arr.length * q)].toFixed(3);
  console.log(
    `${label}: 冷态 total=${coldMs.toFixed(2)}ms exec=${coldExec.totalMs.toFixed(3)}ms | ` +
      `热态 p50 total=${p(totals, 0.5)}ms exec=${p(execs, 0.5)}ms | ` +
      `p90 total=${p(totals, 0.9)}ms | 包装开销 p50 = ${(Number(p(totals, 0.5)) - Number(p(execs, 0.5))).toFixed(3)}ms`,
  );
}

const args = { where: { id: userId }, select: { id: true, email: true, avatar: true, nickname: true } };

/** 预热两轮（JIT/validator 编译） */
for (let i = 0; i < 200; i++) {
  await base.user.findUnique(args as any);
  await authed.user.findUnique(args as any);
}

await bench('基座(仅软删除) user.findUnique ', () => base.user.findUnique(args as any));
await bench('带权限(PolicyPlugin) user.findUnique', () => authed.user.findUnique(args as any));

/** 第二个用户：冷态是否还要付冷启动税（验证 validator/prepare/规则编译是否跨 user 复用） */
const user2 = seed[1] ?? user;
const authed2 = deriveAuthClient(base as any, user2 as any);
const args2 = { where: { id: user2.id }, select: { id: true, email: true, avatar: true, nickname: true } };
const c0 = performance.now();
await authed2.user.findUnique(args2 as any);
console.log(`第二个用户首次调用(无预热): ${(performance.now() - c0).toFixed(2)}ms`);
await bench('第二个用户(带权限)       user.findUnique', () => authed2.user.findUnique(args2 as any), 1000);

/** 打印带权限下真实生成的 SQL：看 auth.id 是内联还是参数占位（决定 prepare 缓存能否跨 user 复用） */
const probe = await engine.claim(() => authed.user.findUnique(args as any));
console.log(`带权限 SQL 首条: ${probe.stmts[0]?.sql.slice(0, 200)}…`);

/** 直接裸 better-sqlite3 同 SQL 执行对照 */
const raw = new Database(dbPath);
const stmt = raw.prepare('select "id","email","avatar","nickname" from "User" where "id" = ? limit 1');
stmt.get(userId);
const t0 = performance.now();
for (let i = 0; i < 2000; i++) stmt.get(userId);
console.log(`裸 better-sqlite3 同 SQL: p50 ≈ ${((performance.now() - t0) / 2000).toFixed(4)}ms`);
raw.close();
