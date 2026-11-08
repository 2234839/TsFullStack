/**
 * 数据库初始化（seed）入口。
 *
 * 具体逻辑在 ./seedCore.ts（不依赖 Effect，worker/直连两模式共用）：
 * - worker 模式（默认）：seed 整体作为一次 RPC 在 dbWorker 内执行，
 *   SQL 与 bcrypt 哈希/比对均不占主线程，主线程只等完成标记
 * - 直连模式（config.dbWorker === false）：进程内直接执行
 */
import { Effect } from 'effect';
import { AppConfigService } from '../Context/AppConfig';
import { getDbWorker } from '../Context/dbWorker/DbWorkerClient';
import { getLocalDbClient } from '../Context/dbWorker/localDb';
import { runSeed, type SeedAdminConfig } from './seedCore';
import { tryOrFail } from '../util/error';

/** 对数据库进行一些初始化设置 */
export const seedDB: Effect.Effect<void, Error, AppConfigService> = Effect.gen(function* () {
  const config = yield* AppConfigService;

  /** seed 所需的管理员配置（含生产环境保护标记） */
  const admin: SeedAdminConfig = {
    adminEmail: config.systemAdminUser.email,
    adminPassword: config.systemAdminUser.password,
    production: process.env.NODE_ENV === 'production',
  };

  if (config.dbWorker !== false) {
    /** worker 模式：会话单例与业务调用共享（getDbWorker 进程级缓存），seed 前已完成 init + 时钟标定 */
    const session = yield* Effect.promise(() => getDbWorker(config.databasePath));
    yield* tryOrFail('数据库初始化', () => session.seed(admin));
  } else {
    /** 直连模式：复用 localDb 的缓存客户端 */
    yield* tryOrFail('数据库初始化', () => runSeed(getLocalDbClient(config.databasePath), admin));
  }
});
