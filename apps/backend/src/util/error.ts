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

// 使用示例
export type MsgErrorOpValues = ExtractOpKeys<typeof MsgError>;
// OpValues 的类型为：'op_toLogin' | 'op_msgError'
