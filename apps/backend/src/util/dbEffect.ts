import { Effect } from 'effect';
import { AuthContext, requireAdmin } from '../Context/Auth';
import { AppConfigService } from '../Context/AppConfig';
import { DbClientEffect, type DbClient } from '../Context/DbService';
import { ReqCtxService } from '../Context/ReqCtx';
import { MsgError, extractErrorMessage, requireOrFail } from './error';
import { DEFAULT_PAGE_SIZE as _DEFAULT_PAGE_SIZE } from './constants';

/** 分页常量统一从本模块导出（单源在 constants.ts） */
export const DEFAULT_PAGE_SIZE = _DEFAULT_PAGE_SIZE;
export const MAX_PAGE_SIZE = 100;

/**
 * 封装数据库操作的 Effect.tryPromise，统一日志记录和错误处理
 *
 * 如果原始错误是 MsgError（业务异常），直接传播以保留错误消息；
 * 其他错误则包装为通用的操作失败消息。
 */
export function dbTry<T>(
  label: string,
  operation: string,
  fn: () => Promise<T>,
): Effect.Effect<T, Error, ReqCtxService> {
  return Effect.flatMap(ReqCtxService, (reqCtx) =>
    Effect.withSpan(
      Effect.tryPromise({
        try: fn,
        catch: (error: unknown) => {
          reqCtx.log(`${label} ${operation}失败:`, extractErrorMessage(error));
          if (error instanceof MsgError) return error;
          return MsgError.msg(`${operation}失败`);
        },
      }),
      `sql:${label}·${operation}`,
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
    Effect.withSpan(
      Effect.catch(
        Effect.tryPromise({
          try: fn,
          catch: (error: unknown) => {
            reqCtx.log(`${label} ${operation}失败，使用默认值:`, extractErrorMessage(error));
            return MsgError.msg(`${operation}失败（静默）`);
          },
        }),
        () => Effect.succeed(defaultValue),
      ),
      `sql:${label}·${operation}`,
    ),
  );
}

/**
 * 分页参数归一化（全后端唯一口径）：page 1-based，无值/非法回退 1；
 * pageSize clamp 到 [1, MAX_PAGE_SIZE]，无值用默认。返回 ZenStack 的 skip/take。
 */
export function pageToSkipTake(page?: number | null, pageSize?: number | null): { skip: number; take: number } {
  const p = Number.isFinite(page) && Number(page) >= 1 ? Math.floor(Number(page)) : 1;
  const size =
    Number.isFinite(pageSize) && Number(pageSize) >= 1
      ? Math.min(MAX_PAGE_SIZE, Math.floor(Number(pageSize)))
      : DEFAULT_PAGE_SIZE;
  return { skip: (p - 1) * size, take: size };
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
  emptyValue?: T[],
): Effect.Effect<{ items: T[]; total: number }, Error, ReqCtxService> {
  return Effect.map(
    Effect.all([
      dbTryOrDefault(label, '查询列表', findManyFn, emptyValue ?? ([] as unknown as T[])),
      dbTryOrDefault(label, '查询总数', countFn, 0),
    ]),
    ([items, total]) => ({ items, total }),
  );
}

/**
 * dbTry + requireOrFail 的组合快捷方式
 *
 * 用于「查询数据库记录，不存在则报错」的常见模式，消除重复的两步调用：
 * `yield* dbTryRequire('标签', '操作', fn, '未找到')` 替代
 * `yield* requireOrFail(yield* dbTry('标签', '操作', fn), '未找到')`
 */
export function dbTryRequire<T>(
  label: string,
  operation: string,
  fn: () => Promise<T | null | undefined>,
  errorMsg: string,
): Effect.Effect<T, Error | MsgError, ReqCtxService> {
  return Effect.flatMap(dbTry<T | null | undefined>(label, operation, fn), (result) => requireOrFail(result, errorMsg));
}

/**
 * 管理员 + 数据库操作的组合 Effect（requireAdmin → DbClientEffect → dbTry）
 * 用于消除 API 层中重复的 `Effect.flatMap(requireAdmin(), () => Effect.flatMap(DbClientEffect, db => dbTry(...)))` 模式
 */
export function adminDbTry<T>(
  label: string,
  operation: string,
  fn: (db: DbClient) => Promise<T>,
): Effect.Effect<T, Error | MsgError, ReqCtxService | AppConfigService | AuthContext> {
  return Effect.flatMap(requireAdmin(), () =>
    Effect.flatMap(DbClientEffect, (db) => dbTry(label, operation, () => fn(db))),
  );
}
