/**
 * 直连模式（dbWorker=false 路径）快速验证：
 * getLocalDbClient CRUD + 原生 $transaction commit/rollback + deriveLocalAuthClient + 快照
 */
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getLocalDbClient, deriveLocalAuthClient, snapshotLocalDriverTimings } from '../src/Context/dbWorker/localDb';

/** 从线上备份库拷一份，避免手工跑迁移 */
const dbPath = join(mkdtempSync(join(tmpdir(), 'localdb-verify-')), 'test.db');
copyFileSync(join(import.meta.dirname, '../backup/dev-20261031-150440.db'), dbPath);
const db = getLocalDbClient(dbPath);
const user = await db.user.create({
  data: { email: 'local-verify@test.dev', password: 'hashed-x', nickname: '直连验证' } as never,
});

// CRUD
const created = await db.userData.create({ data: { key: '直连验证', data: { v: 1 }, userId: user.id } as never });
const found = await db.userData.findFirst({ where: { id: created.id } as never });
console.log('[1 CRUD] created=', !!created, 'found=', found?.id === created.id ? '一致' : '不一致');

// 事务 commit
await db.$transaction(async (tx) => {
  await tx.userData.create({ data: { key: 'tx-commit', data: { v: 2 }, userId: user.id } as never });
});
const afterCommit = await db.userData.findFirst({ where: { key: 'tx-commit' } as never });
console.log('[2 tx commit]', afterCommit ? '✅' : '❌');

// 事务 rollback
try {
  await db.$transaction(async (tx) => {
    await tx.userData.create({ data: { key: 'tx-rollback', data: { v: 3 }, userId: user.id } as never });
    throw new Error('故意回滚');
  });
} catch (e) {
  /** 预期抛错 */
}
const afterRollback = await db.userData.findFirst({ where: { key: 'tx-rollback' } as never });
console.log('[3 tx rollback]', afterRollback ? '❌ 残留' : '✅');

// 权限派生客户端（带 role/userSession 关系，与真实鉴权路径一致）
const fullUser = await db.user.findFirst({
  where: { id: user.id } as never,
  include: { role: true, userSession: true } as never,
});
if (fullUser) {
  const authed = deriveLocalAuthClient(dbPath, fullUser);
  console.log('[4 deriveAuthClient]', typeof authed.userData?.findFirst === 'function' ? '✅' : '❌');
} else {
  console.log('[4 deriveAuthClient] 跳过（无用户）');
}

// 驱动快照（同步）
const snap = snapshotLocalDriverTimings(0, performance.now() + 1000);
console.log('[5 snapshot] 条数=', snap.length, snap.length > 0 ? '✅' : '❌');

console.log('直连模式验证完成');
