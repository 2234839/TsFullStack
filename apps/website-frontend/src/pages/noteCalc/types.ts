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
