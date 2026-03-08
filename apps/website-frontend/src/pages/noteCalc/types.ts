// 定义计算结果的类型
export interface CalculationResult {
  type:
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
  content: string;
  result?: string;
  error?: string;
  /** 表示计算结果是否在误差范围内,为 false 表示超出了误差范围，也就是不正确 */
  isCorrect?: boolean;
  /** 是否是简单的赋值语句，例如 `a = 10` */
  isSimpleAssignment?: boolean;
  isLargeNumber?: boolean;
  formattedNumber?: string;
  highlightedContent?: Array<{ text: string; isNumber: boolean }>;
}

// 定义行变化的类型
export interface TextDiff {
  type: 'insert' | 'delete' | 'modify' | 'none';
  lineIndex: number;
  content?: string;
}

// 定义计算器配置
export interface CalculatorConfig {
  precision: number;
  showPrecision: number;
}

/** 行类型 */
export type LineType =
  | 'empty'
  | 'comment'
  | 'title'
  | 'subtitle'
  | 'assignment'
  | 'expression'
  | 'unitConversion'
  | 'equation'
  | 'normal';

/** 语法高亮部分 */
export interface HighlightedPart {
  text: string;
  type: 'text' | 'number' | 'variable' | 'operator' | 'function';
}

/** 解析后的行 */
export interface ParsedLine {
  type: LineType;
  content: string;
  varName?: string;
  expression?: string;
  targetUnit?: string;
}

/** 光标位置 */
export interface CursorPosition {
  lineIndex: number;
  offset: number;
}

/** 行渲染属性 */
export interface LineRenderProps {
  line: string;
  result: CalculationResult;
  lineIndex: number;
  isFocused: boolean;
  showResult: boolean;
}

/** 表格单元格位置 */
export interface TableCellPosition {
  row: number;      // 行号（0-based）
  col: number;      // 列号（0-based）
  tableId: string;  // 表格 ID
}

/** 表格单元格 */
export interface TableCell {
  position: TableCellPosition;
  rawContent: string;      // 原始内容
  formula?: string;        // 公式（如果有）
  value?: any;            // 计算结果
  references?: string[];  // 引用的其他单元格（如 A1, B2）
}

/** 表格 */
export interface Table {
  id: string;
  rows: number;
  cols: number;
  cells: TableCell[][];
  startLine: number;  // 表格在文档中的起始行号
  endLine: number;    // 表格在文档中的结束行号
}
