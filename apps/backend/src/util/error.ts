import { Data, Effect } from 'effect';

/**
 * 普通消息错误（展示提示，无跳转动作）
 */
export class MsgError extends Data.TaggedError('MsgError')<{
  /** 可读错误消息 */
  readonly message: string;
}> {
  /** 快捷构造普通消息错误 */
  static msg(message: string) {
    return new MsgError({ message });
  }
  static isMsgError(err: unknown): err is MsgError {
    return err instanceof MsgError;
  }
}

/**
 * 登出错误：前端收到后清理本地认证信息并跳转登录页
 */
export class LogoutError extends Data.TaggedError('LogoutError')<{
  /** 可读错误消息 */
  readonly message: string;
}> {
  static msg(message: string) {
    return new LogoutError({ message });
  }
}

/**
 * 跳转登录页错误：不清理本地数据，仅跳转
 */
export class ToLoginError extends Data.TaggedError('ToLoginError')<{
  /** 可读错误消息 */
  readonly message: string;
}> {
  static msg(message: string) {
    return new ToLoginError({ message });
  }
}

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
    catch: (e) => {
      /** 已是 MsgError 直接返回，避免重复包装 */
      if (MsgError.isMsgError(e)) return e;
      const wrapped = MsgError.msg(`${label}失败: ${String(e)}`);
      wrapped.cause = e;
      return wrapped;
    },
  });
}
