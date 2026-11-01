/**
 * worker 转发层系统性差异对比验证：
 * 对 schema 全部模型的全部只读方法 + 代表性写方法 × 多种参数形式，
 * 同一数据库分别在「直连模式」与「worker 模式」下执行，逐一对比：
 * - 返回值深度一致（JSON 规范化后对比，含字段顺序无关）
 * - 抛错时错误 message 一致
 * - 额外覆盖 structuredClone 边界参数（Date/Uint8Array/嵌套数组/null/undefined 属性）
 *
 * 跑法：cd apps/backend && timeout 300 pnpm tsx test/dbworker-full-matrix.ts
 */
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getLocalDbClient, deriveLocalAuthClient } from '../src/Context/dbWorker/localDb';
import { getDbWorker } from '../src/Context/dbWorker/DbWorkerClient';

const WORKER_ENTRY = join(import.meta.dirname, '../dist/Context/dbWorker/workerEntry.mjs');
process.env.TSFS_DB_WORKER_FILE = WORKER_ENTRY;

const dbPath = join(mkdtempSync(join(tmpdir(), 'dbmatrix-')), 'test.db');
copyFileSync(join(import.meta.dirname, '../backup/dev-20261031-150440.db'), dbPath);

/** 参与矩阵的模型（覆盖 schema 主要形态：必填关系/Json 字段/软删除/枚举） */
const MODELS = [
  'user',
  'role',
  'userData',
  'file',
  'queue',
  'content',
  'userSession',
  'oAuthAccount',
  'systemLog',
  'diagTrace',
  'groupEntryProject',
  'groupStatDaily',
] as const;

/** 只读方法 × 参数形式矩阵（args 全部是合法可克隆数据） */
const READ_MATRIX: Array<{ method: string; args: unknown[] }> = [
  { method: 'findMany', args: [] },
  { method: 'findMany', args: [{ take: 2 }] },
  { method: 'findMany', args: [{ take: 1, skip: 1, orderBy: { id: 'asc' } }] },
  { method: 'findMany', args: [{ take: 2, orderBy: [{ id: 'desc' }, { createdAt: 'asc' }], distinct: ['id'] }] },
  { method: 'findMany', args: [{ take: 2, select: { id: true } }] },
  { method: 'findFirst', args: [] },
  { method: 'findFirst', args: [{ where: { id: { not: null } }, rejectOnNotFound: false }] },
  { method: 'findFirstOrThrow', args: [{ take: 1, orderBy: { id: 'asc' } }] },
  { method: 'count', args: [] },
  { method: 'count', args: [{ take: 5 }] },
  { method: 'aggregate', args: [{ _count: { _all: true }, take: 3 }] },
  { method: 'groupBy', args: [{ by: ['id'], take: 2, _count: { _all: true } }] },
];

/** 代表性写方法（跑在独立临时行上，两模式各建各的、互不干扰；对比行为而非数据） */
const WRITE_CASES: Array<{ name: string; run: (db: any) => Promise<unknown> }> = [
  {
    name: 'upsert-insert',
    run: (db) =>
      db.userData.upsert({
        where: { userId_key_appId: { userId: SEED_USER_ID, key: `up-${TAG}`, appId: null } },
        create: { key: `up-${TAG}`, data: { v: 1 }, userId: SEED_USER_ID },
        update: { data: { v: 2 } },
      }),
  },
  {
    name: 'updateMany',
    run: (db) => db.userData.updateMany({ where: { key: `up-${TAG}` }, data: { description: '批量' } }),
  },
  {
    name: 'createMany',
    run: (db) =>
      db.userData.createMany({
        data: [
          { key: `cm-${TAG}`, data: { v: 1 }, userId: SEED_USER_ID },
          { key: `cm2-${TAG}`, data: { v: 2 }, userId: SEED_USER_ID },
        ],
      }),
  },
  {
    name: 'nested-connect',
    run: (db) =>
      db.userData.create({ data: { key: `nc-${TAG}`, data: { v: 1 }, user: { connect: { id: SEED_USER_ID } } } }),
  },
  {
    name: 'nested-create',
    run: (db) =>
      db.userSession.create({
        data: { token: `tk-${TAG}`, expiresAt: new Date('2030-01-01'), user: { connect: { id: SEED_USER_ID } } },
      }),
  },
  {
    name: 'date-roundtrip',
    run: (db) =>
      db.userData.update({
        where: { userId_key_appId: { userId: SEED_USER_ID, key: `nc-${TAG}`, appId: null } },
        data: { data: { at: new Date('2026-06-01T12:00:00Z') } },
      }),
  },
  {
    name: 'deleteMany',
    run: (db) =>
      db.userData.deleteMany({ where: { key: { in: [`up-${TAG}`, `cm-${TAG}`, `cm2-${TAG}`, `nc-${TAG}`] } } }),
  },
];

/** 两种模式各自独立的数据标记（写用例各自隔离，只对比结构化行为） */
const TAG_LOCAL = 'L1';
const TAG_WORKER = 'W1';
let SEED_USER_ID = '';

/** JSON 规范化（键排序+Date/BigInt 统一），使对比与字段顺序无关；忽略写用例噪声字段（两模式各插各的行，id/时间戳天然不同） */
function normalize(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val instanceof Date) return { __date: val.toISOString() };
    if (typeof val === 'bigint') return val.toString();
    if (val instanceof Uint8Array) return { __bytes: Array.from(val) };
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const entries = Object.entries(val as Record<string, unknown>).filter(([k]) => !NOISE_FIELDS.has(k));
      return Object.fromEntries(entries.sort(([a], [b]) => (a < b ? -1 : 1)));
    }
    return val;
  });
}

/** 写用例噪声字段（两模式各插各的行，id/时间戳天然不同） */
const NOISE_FIELDS = new Set(['id', 'created', 'updated', 'createdAt', 'updatedAt']);

/** 在一种客户端上执行一个用例，返回 {ok, value|message}（错误也算可对比结果）。
 *  注意必须直接调用而不能 fn.apply 反射：worker 代理的 get('apply') 会被当成模型方法名转发 */
async function exec(db: any, model: string, method: string, args: unknown[]): Promise<string> {
  try {
    const modelApi = db[model];
    const fn = modelApi?.[method];
    if (typeof fn !== 'function') return `NO_METHOD:${model}.${method}`;
    const result = await fn(...args);
    return `OK:${normalize(result)}`;
  } catch (e) {
    /** 错误比较口径：name（跨线程可保真，deserializeError 已恢复）+ message；constructor 类无法跨线程保真，不作比较 */
    const msg = (e as Error).message.replace(/: undefined/g, ': null');
    return `ERR:${(e as Error).name}:${msg}`;
  }
}

async function main() {
  // 直连客户端 + 找 seed 用户
  const local = getLocalDbClient(dbPath);
  const seedUser = await local.user.findFirst({ orderBy: { id: 'asc' } });
  if (!seedUser) throw new Error('备份库无用户，无法跑写用例');
  SEED_USER_ID = seedUser.id;

  // worker 客户端
  const session = await getDbWorker(dbPath);
  const worker = session.proxyFor('base');

  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  /** 只读矩阵：同一库两模式跑，结果必须一致 */
  for (const model of MODELS) {
    for (const { method, args } of READ_MATRIX) {
      const a = await exec(local, model, method, args);
      /** local 上不存在的方法（TS 类型层面调不到）：跳过对比 */
      if (a.startsWith('NO_METHOD')) continue;
      const b = await exec(worker, model, method, args);
      if (a === b) {
        pass++;
      } else {
        fail++;
        failures.push(
          `[READ] ${model}.${method}(${JSON.stringify(args)})\n  local: ${a.slice(0, 300)}\n  worker: ${b.slice(0, 300)}`,
        );
      }
    }
  }
  console.log(
    `[READ 矩阵] ${MODELS.length} 模型 × ${READ_MATRIX.length} 方法/参数形式 = ${MODELS.length * READ_MATRIX.length} 项，一致=${pass} 不一致=${fail}`,
  );

  /** 写用例：结构化行为对比（upsert/updateMany/createMany/nested/date/克隆边界） */
  let wPass = 0;
  let wFail = 0;
  for (const tc of WRITE_CASES) {
    const results: string[] = [];
    for (const mode of ['local', 'worker'] as const) {
      TAG = mode === 'local' ? TAG_LOCAL : TAG_WORKER;
      const db = mode === 'local' ? local : worker;
      try {
        const r = await tc.run(db);
        results.push(`OK:${normalize(r).replaceAll(TAG_LOCAL, 'T').replaceAll(TAG_WORKER, 'T')}`);
      } catch (e) {
        results.push(
          `ERR:${(e as Error).name}:${(e as Error).message}`.replaceAll(TAG_LOCAL, 'T').replaceAll(TAG_WORKER, 'T'),
        );
      }
    }
    if (results[0] === results[1]) {
      wPass++;
    } else {
      wFail++;
      failures.push(`[WRITE] ${tc.name}\n  local: ${results[0].slice(0, 300)}\n  worker: ${results[1].slice(0, 300)}`);
    }
  }
  console.log(`[WRITE 用例] 一致=${wPass} 不一致=${wFail}`);

  /** structuredClone 边界参数（findMany 传 Date/Uint8Array/嵌套/null/undefined 属性） */
  const boundaryArgs = [
    [{ where: { createdAt: { gte: new Date('2000-01-01') }, AND: [{ OR: [{ id: { contains: '' } }] }] }, take: 1 }],
    [{ where: { id: { not: undefined as unknown as string } }, take: 1 }],
    [{ where: { OR: [{ id: null }, { AND: [] }] }, take: 1 }],
  ];
  let bPass = 0;
  let bFail = 0;
  for (const args of boundaryArgs) {
    const a = await exec(local, 'user', 'findMany', args);
    const b = await exec(worker, 'user', 'findMany', args);
    if (a === b) bPass++;
    else {
      bFail++;
      failures.push(
        `[BOUNDARY] user.findMany(${JSON.stringify(args)})\n  local: ${a.slice(0, 300)}\n  worker: ${b.slice(0, 300)}`,
      );
    }
  }
  console.log(`[参数边界] 一致=${bPass} 不一致=${bFail}`);

  /** 权限派生客户端一致性（base 无 Policy vs auth 有 Policy 的行为也应在两模式一致） */
  const fullUser = await local.user.findFirst({
    where: { id: SEED_USER_ID },
    include: { role: true, userSession: true },
  });
  if (fullUser) {
    const localAuth = deriveLocalAuthClient(dbPath, fullUser);
    const workerAuth = worker.$setAuth(fullUser);
    const a = await exec(localAuth, 'userData', 'findMany', [{ take: 3 }]);
    const b = await exec(workerAuth, 'userData', 'findMany', [{ take: 3 }]);
    if (a === b) console.log('[AUTH 派生] 一致 ✅');
    else {
      failures.push(`[AUTH] userData.findMany\n  local: ${a.slice(0, 300)}\n  worker: ${b.slice(0, 300)}`);
    }
  }

  if (failures.length) {
    console.log('\n===== 不一致明细 =====');
    for (const f of failures) console.log(f + '\n');
    process.exitCode = 1;
  } else {
    console.log('\n全矩阵一致：worker 转发层对 ORM 方法×参数形式无损 ✅');
  }
}

/** 当前写用例使用的 TAG（run 闭包读取） */
let TAG = TAG_LOCAL;

main().catch((e) => {
  console.error('矩阵验证崩溃:', e);
  process.exitCode = 1;
});
