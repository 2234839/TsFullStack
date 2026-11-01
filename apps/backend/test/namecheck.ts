/** worker 错误 name 恢复检查 */
process.env.TSFS_DB_WORKER_FILE = new URL('../dist/Context/dbWorker/workerEntry.mjs', import.meta.url).pathname;
const { getDbWorker } = await import('../src/Context/dbWorker/DbWorkerClient');
const s = await getDbWorker('/tmp/dbworker-verify.db');
const db = s.proxyFor('base');
try {
  await db.userData.update({ where: { id: 1 }, data: { data: { at: new Date() } } });
} catch (e) {
  console.log('update name=', JSON.stringify((e as Error).name), '|', (e as Error).message.slice(0, 50));
}
try {
  await db.user.findFirst({ where: { id: { not: null } } });
} catch (e2) {
  console.log('find   name=', JSON.stringify((e2 as Error).name), '|', (e2 as Error).message.slice(0, 50));
}
process.exit(0);
