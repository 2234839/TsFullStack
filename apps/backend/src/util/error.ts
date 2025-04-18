export class MsgError extends Error {
  constructor(public op: MsgErrorOpValues, message: string) {
    super(message);
    this.name = 'MsgError';
  }
  static op_toLogin = 'op_toLogin' as const;
  static op_msgError = 'op_msgError' as const;
  static op_toRegister = 'op_toRegister' as const;
  static op_toForgotPassword = 'op_toForgotPassword' as const;
}
type ExtractOpKeys<T> = {
  [K in keyof T]: K extends `op_${string}` ? T[K] : never;
}[keyof T];

// 使用示例
export type MsgErrorOpValues = ExtractOpKeys<typeof MsgError>;
// OpValues 的类型为：'op_toLogin' | 'op_msgError' | 'op_toRegister' | 'op_toForgotPassword'
