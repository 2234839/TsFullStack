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
    | 'unitConversion';
  content: string;
  result?: string;
  error?: string;
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
