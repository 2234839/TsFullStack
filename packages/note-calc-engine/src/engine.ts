import { tokenize } from './parser/tokenizer';
import { Parser } from './parser/parser';
import { evaluate as evalAST, formatEvalResult, type EvalResult, type Scope } from './parser/evaluator';
import { isUnitValue } from './units/converter';
import type { CalcRequest, CalcResponse, LineResult } from './types';

/** 单次请求最大行数 */
const MAX_LINES = 2000;

/** 最大表达式长度 */
const MAX_EXPR_LENGTH = 50000;

/** 将 eval 结果安全转为数字 */
function toNumber(result: EvalResult): number {
  if (isUnitValue(result)) return result.value;
  return typeof result === 'number' ? result : Number.NaN;
}

/** 计算单个表达式 */
function evalExpression(expression: string, scope: Scope): EvalResult {
  if (expression.length > MAX_EXPR_LENGTH) {
    throw new Error(`表达式过长（最大 ${MAX_EXPR_LENGTH} 字符）`);
  }
  const tokens = tokenize(expression);
  const ast = Parser.parse(tokens);
  return evalAST(ast, scope);
}

/**
 * 计算表达式内容
 * 接收多行表达式，逐行计算并返回结果
 */
export function evaluate(params: CalcRequest): CalcResponse {
  const { content, showPrecision = 4 } = params;
  const lines = content.split('\n');

  if (lines.length > MAX_LINES) {
    throw new Error(`内容不能超过 ${MAX_LINES} 行`);
  }

  /** 变量作用域，直接支持中文变量名 */
  const scope: Scope = {};

  /** 格式化结果 */
  function formatResult(result: EvalResult): string {
    return formatEvalResult(result, showPrecision);
  }

  /** 计算单行 */
  function calculateLine(line: string): LineResult {
    /** 标题 */
    if (line.startsWith('# '))
      return { line, type: 'title', result: null, error: null, isCorrect: null, variable: null };
    if (line.startsWith('## '))
      return { line, type: 'subtitle', result: null, error: null, isCorrect: null, variable: null };
    if (line.trim() === '')
      return { line, type: 'empty', result: null, error: null, isCorrect: null, variable: null };
    if (line.startsWith('//'))
      return { line, type: 'comment', result: null, error: null, isCorrect: null, variable: null };

    /** 变量赋值: 标识符 = 表达式 */
    const assignmentMatch = line.match(/^([a-zA-Z0-9_一-龥]+)\s*=\s*(.+)$/);
    if (assignmentMatch) {
      const varName = assignmentMatch[1]!.trim();
      const expression = assignmentMatch[2]!.trim();
      /** 右侧不含等号才视为赋值 */
      if (!expression.includes('=')) {
        try {
          const result = evalExpression(expression, scope);
          scope[varName] = result;
          const resultDisplay = formatResult(result);
          return { line, type: 'assignment', result: resultDisplay, error: null, isCorrect: null, variable: varName };
        } catch (e: unknown) {
          return { line, type: 'error', result: null, error: String(e), isCorrect: null, variable: null };
        }
      }
    }

    /** 等式验证: 表达式 = 表达式 */
    const equalsMatch = line.match(/^(.+)=(.+)$/);
    if (equalsMatch) {
      const leftExpression = equalsMatch[1]!.trim();
      const rightExpression = equalsMatch[2]!.trim();
      /** 左侧不是简单变量名（否则已在赋值中处理） */
      if (!/^[a-zA-Z0-9_一-龥]+$/.test(leftExpression)) {
        try {
          const leftResult = evalExpression(leftExpression, scope);
          const leftDisplay = formatResult(leftResult);
          const isRightNumeric = /^\s*\d+(\.\d+)?\s*$/.test(rightExpression);
          if (isRightNumeric) {
            const rightValue = Number.parseFloat(rightExpression);
            const isCorrect = Math.abs(toNumber(leftResult) - rightValue) < 1e-10;
            return { line, type: 'equation', result: leftDisplay, error: null, isCorrect, variable: null };
          }
          const rightResult = evalExpression(rightExpression, scope);
          const isCorrect = Math.abs(toNumber(leftResult) - toNumber(rightResult)) < 1e-10;
          return { line, type: 'equation', result: leftDisplay, error: null, isCorrect, variable: null };
        } catch (e: unknown) {
          return { line, type: 'error', result: null, error: String(e), isCorrect: null, variable: null };
        }
      }
    }

    /** 普通表达式（含 to 单位转换） */
    try {
      const result = evalExpression(line, scope);
      const resultDisplay = formatResult(result);
      /** 如果是单位转换结果（行包含 to 关键字） */
      const isConversion = /\bto\b/i.test(line) && isUnitValue(result);
      return {
        line,
        type: isConversion ? 'unitConversion' : 'expression',
        result: resultDisplay,
        error: null,
        isCorrect: null,
        variable: null,
      };
    } catch {
      return { line, type: 'normal', result: null, error: null, isCorrect: null, variable: null };
    }
  }

  /** 逐行计算 */
  const results: LineResult[] = [];
  for (const line of lines) {
    results.push(calculateLine(line || ''));
  }

  return { results };
}
