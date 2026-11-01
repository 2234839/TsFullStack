/**
 * worker 侧真实客户端的公开类型（纯类型模块，两侧共用，运行时零依赖）。
 *
 * DbService 对外的 DbClient 即此类型；worker 侧的注册表存的是它的真实实例，
 * 主线程侧是同类型的 Proxy 代理。
 */
import type { ClientContract } from '@zenstackhq/orm';
import type { SqliteDialect } from '@zenstackhq/orm/dialects/sqlite';
import type { SchemaType } from '../../../.zenstack/schema';

export type WorkerDbClient = ClientContract<
  SchemaType,
  {
    dialect: SqliteDialect;
  },
  {},
  {}
>;
