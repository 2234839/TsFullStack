/** 行计算结果类型 */
export type ResultType =
  | 'normal'
  | 'title'
  | 'subtitle'
  | 'empty'
  | 'comment'
  | 'error'
  | 'assignment'
  | 'expression'
  | 'equation'
  | 'unitConversion';

/** 单行计算结果 */
export interface LineResult {
  /** 行内容 */
  line: string;
  /** 结果类型 */
  type: ResultType;
  /** 计算结果值，无结果时为 null */
  result: string | null;
  /** 错误信息 */
  error: string | null;
  /** 等式验证是否正确（仅 equation 类型） */
  isCorrect: boolean | null;
  /** 定义的变量名（仅 assignment 类型） */
  variable: string | null;
}

/** 计算请求参数 */
export interface CalcRequest {
  /** 多行表达式内容 */
  content: string;
  /** 计算精度（默认 64） */
  precision?: number;
  /** 显示精度（默认 4） */
  showPrecision?: number;
}

/** 计算响应 */
export interface CalcResponse {
  /** 每行的计算结果 */
  results: LineResult[];
}
