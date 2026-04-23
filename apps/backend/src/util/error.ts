import { Effect } from 'effect';

/** Effect.fail 的便捷封装，附带 never return 以缩小类型范围 */
export const fail = (msg: string) => Effect.fail(MsgError.msg(msg));
/** 用于 Effect.gen 中 fail() 后的 never return，帮助 TS 收窄类型 */
export const neverReturn = () => undefined as never;

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
