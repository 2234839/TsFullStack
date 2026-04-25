import { Effect } from 'effect';

/** 从未知错误中提取可读消息 */
export function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Effect.fail 的便捷封装 */
export const fail = (msg: string) => Effect.fail(MsgError.msg(msg));

/**
 * 非空断言 + fail 的组合操作
 *
 * 用法: `const val = yield* requireOrFail(nullable, 'msg')`
 */
export function requireOrFail<T>(value: T | null | undefined, msg: string) {
  if (value == null) return Effect.fail(MsgError.msg(msg));
  return Effect.succeed(value as NonNullable<T>);
}

/**
 * 通用 tryPromise 错误包装
 *
 * 消除重复的 `Effect.tryPromise({ try: fn, catch: (e) => MsgError.msg('${label}失败: ' + String(e)) })` 模式。
 * 用法: `yield* tryOrFail('创建目录', () => mkdir(...))`
 */
export function tryOrFail<T>(label: string, fn: () => Promise<T>) {
  return Effect.tryPromise({
    try: fn,
    catch: (e) => MsgError.msg(`${label}失败: ${String(e)}`),
  });
}

export class MsgError extends Error {
  static errorTag = 'MsgError';
  /** 登出：清理本地认证信息并跳转登录页 */
  static op_logout = 'op_logout' as const;
  /** 跳转登录页：不清理本地数据，仅跳转 */
  static op_toLogin = 'op_toLogin' as const;
  /** 普通消息错误：显示错误提示 */
  static op_msgError = 'op_msgError' as const;

  static msg(message: string) {
    return new MsgError(MsgError.op_msgError, message);
  }
  static isMsgError(err: unknown): err is MsgError {
    return err instanceof MsgError;
  }
  errorTag = MsgError.errorTag;
  constructor(public op: MsgErrorOpValues, message: string) {
    super(message);
    this.name = 'MsgError';
  }
}
type ExtractOpKeys<T> = {
  [K in keyof T]: K extends `op_${string}` ? T[K] : never;
}[keyof T];

export type MsgErrorOpValues = ExtractOpKeys<typeof MsgError>;
