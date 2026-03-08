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
    | 'unitConversion'
    | 'table';
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
  /** 表格数据（当 type === 'table' 时） */
  tableData?: TableData;
}

/** 表格单元格 */
export interface TableCell {
  value: string;
  isFormula: boolean;
  calculatedValue?: string | number;
  error?: string;
}

/** 表格行 */
export interface TableRow {
  cells: TableCell[];
}

/** 表格数据 */
export interface TableData {
  rows: TableRow[];
  hasFormulas: boolean;
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
  | 'normal'
  | 'table';

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
