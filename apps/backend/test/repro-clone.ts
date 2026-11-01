/** 最小复现：worker 模式下 findMany 克隆错误定位 */
process.env.TSFS_DB_WORKER_FILE = new URL('../dist/Context/dbWorker/workerEntry.mjs', import.meta.url).href.replace(
  'file://',
  '',
);
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDbWorker } from '../src/Context/dbWorker/DbWorkerClient';
import { getLocalDbClient } from '../src/Context/dbWorker/localDb';

const dbPath = join(mkdtempSync(join(tmpdir(), 'repro-')), 't.db');
copyFileSync(join(import.meta.dirname, '../backup/dev-20261031-150440.db'), dbPath);

/** 复现矩阵特有顺序：先建 local 客户端并查询 */
const local = getLocalDbClient(dbPath);
const lr = await local.user.findMany({ take: 1, select: { id: true } });
console.log('local OK', JSON.stringify(lr));

const session = await getDbWorker(dbPath);
const db = session.proxyFor('base');
/** 完全复刻矩阵的反射调用路径 */
const model = (db as never as Record<string, Record<string, (...a: unknown[]) => unknown>>)['user'];
const fn = model['findMany'];
try {
  const r = await fn.apply(model, [{ take: 2, select: { id: true } }]);
  console.log('reflect OK', JSON.stringify(r));
} catch (e) {
  console.error('reflect FAIL', e);
}
try {
  const r = await db.user.findMany({ take: 2, select: { id: true } });
  console.log('OK', JSON.stringify(r));
} catch (e) {
  console.error('FAIL', e);
}
try {
  const r2 = await db.user.count();
  console.log('count OK', r2);
} catch (e) {
  console.error('count FAIL', e);
}
process.exit(0);
