import { Effect } from 'effect';
import { ReqCtxService } from '../Context/ReqCtx';
import { MsgError } from './error';

/**
 * 封装数据库操作的 Effect.tryPromise，统一日志记录和错误处理
 *
 * 使用 Effect.flatMap 而非 Effect.gen 包裹，确保 yield* 时类型正确传递
 */
export function dbTry<T>(
  label: string,
  operation: string,
  fn: () => Promise<T>,
): Effect.Effect<T, Error, ReqCtxService> {
  return Effect.flatMap(ReqCtxService, (reqCtx) =>
    Effect.mapError(
      Effect.tryPromise({
        try: fn,
        catch: (error: unknown) => {
          reqCtx.log(`${label} ${operation}失败:`, String(error));
          return MsgError.msg(`${operation}失败`);
        },
      }),
      () => MsgError.msg(`${operation}失败`),
    ),
  );
}

/**
 * 封装数据库操作的 Effect.tryPromise（静默版本，失败时返回默认值而非抛出）
 */
export function dbTryOrDefault<T>(
  label: string,
  operation: string,
  fn: () => Promise<T>,
  defaultValue: T,
): Effect.Effect<T, never, ReqCtxService> {
  return Effect.flatMap(ReqCtxService, (reqCtx) =>
    Effect.catchAll(
      Effect.tryPromise({
        try: fn,
        catch: (error: unknown) => {
          reqCtx.log(`${label} ${operation}失败，使用默认值:`, String(error));
          return MsgError.msg(`${operation}失败（静默）`);
        },
      }),
      () => Effect.succeed(defaultValue),
    ),
  );
}

/**
 * 通用的分页查询：并行执行 findMany + count，返回 { items, total }
 *
 * 消除 Service 层重复的 [findMany, count] + Effect.all 模式
 */
export function dbPaginatedFindMany<T>(
  label: string,
  findManyFn: () => Promise<T[]>,
  countFn: () => Promise<number>,
  emptyValue: T[],
): Effect.Effect<{ items: T[]; total: number }, Error | never, ReqCtxService> {
  return Effect.flatMap(Effect.all([
    dbTryOrDefault(label, '查询列表', findManyFn, emptyValue),
    dbTryOrDefault(label, '查询总数', countFn, 0),
  ]), ([items, total]) => Effect.succeed({ items, total }));
}
