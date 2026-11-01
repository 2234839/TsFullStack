/**
 * worker 调用开销归因：structuredClone / JSON / 消息往返 各占多少，
 * 以及响应体大小对耗时的影响（找序列化优化空间）
 */
process.env.TSFS_DB_WORKER_FILE = new URL('../dist/Context/dbWorker/workerEntry.mjs', import.meta.url).pathname;
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDbWorker } from '../src/Context/dbWorker/DbWorkerClient';

const dbPath = join(mkdtempSync(join(tmpdir(), 'attr-')), 't.db');
copyFileSync(join(import.meta.dirname, '../backup/dev-20261031-150440.db'), dbPath);
const session = await getDbWorker(dbPath);
const db = session.proxyFor('base');

// 基准 1：纯 structuredClone 成本（不同结果集大小）
const sizes = [1, 50, 100, 500];
for (const n of sizes) {
  const rows = await db.user.findMany({ take: n });
  const payload = { id: 1, ok: true, result: rows, events: [] };
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) structuredClone(payload);
  const cloneMs = (performance.now() - t0) / 200;
  const t1 = performance.now();
  for (let i = 0; i < 200; i++) JSON.parse(JSON.stringify(payload));
  const jsonMs = (performance.now() - t1) / 200;
  console.log(
    `[克隆成本] rows=${n} 结构化克隆=${cloneMs.toFixed(3)}ms  JSON往返=${jsonMs.toFixed(3)}ms  数据量=${(JSON.stringify(rows).length / 1024).toFixed(1)}KB`,
  );
}

// 基准 2：无业务开销的空往返（发 clockSync 测纯通道延迟）
{
  await session.channel.request({ type: 'clockSync', tMs: 0 });
  const t0 = performance.now();
  for (let i = 0; i < 500; i++) await session.channel.request({ type: 'clockSync', tMs: 0 });
  console.log(`[空往返] ${(performance.now() - t0) / 500}ms/次`);
}

// 基准 3：真实调用总耗时（对照，求序列化占比）
for (const n of [1, 100]) {
  await db.user.findMany({ take: n });
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) await db.user.findMany({ take: n });
  console.log(`[真实调用] rows=${n} ${(performance.now() - t0) / 200}ms/次`);
}
process.exit(0);
