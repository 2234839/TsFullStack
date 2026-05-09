import { all, create } from 'mathjs';
import type { CalcRequest, CalcResponse, LineResult } from './types';

/** 单次请求最大行数 */
const MAX_LINES = 200;

/** 创建 mathjs 实例 */
function createMathInstance(precision: number) {
  return create(all, {
    number: 'number',
    precision,
  });
}

/** 格式化结果为字符串 */
function formatResult(
  result: unknown,
  mathInstance: ReturnType<typeof createMathInstance>,
  showPrecision: number,
): string {
  if (result === null || result === undefined) return 'undefined';

  if (typeof result === 'number') {
    if (Number.isInteger(result)) return String(result);
    return mathInstance.format(result, { precision: showPrecision, notation: 'auto' });
  }

  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;
    if ('unit' in obj || 'value' in obj) {
      if (typeof obj.value === 'number') {
        const formattedValue = mathInstance.format(obj.value, {
          precision: 15,
          notation: 'auto',
        });
        if (obj.unit && typeof obj.unit === 'object' && 'toString' in obj.unit) {
          return `${formattedValue} ${(obj.unit as { toString(): string }).toString()}`;
        }
        return formattedValue;
      }
    }
    return String(result);
  }

  return String(result);
}

/** 将 eval 结果安全转为数字 */
function toNumber(result: unknown): number {
  return typeof result === 'number' ? result : Number.NaN;
}

/**
 * 计算表达式内容
 * 接收多行表达式，逐行计算并返回结果
 */
export function evaluate(params: CalcRequest): CalcResponse {
  const { content, precision = 64, showPrecision = 4 } = params;
  const lines = content.split('\n');

  if (lines.length > MAX_LINES) {
    throw new Error(`内容不能超过 ${MAX_LINES} 行`);
  }

  const mathInstance = createMathInstance(precision);
  const variables: Record<string, unknown> = {};
  /** 中文变量名到安全变量名的映射 */
  const varMap: Record<string, string> = {};
  let varCounter = 0;

  /** 初始化变量映射：扫描所有行收集变量定义 */
  function initVarMap() {
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_一-龥]+)\s*=\s*(.+)$/);
      if (match) {
        const varName = match[1]?.trim() ?? '';
        const expr = match[2]?.trim() || '';
        if (!expr.includes('=') && !varMap[varName]) {
          varMap[varName] = `v${varCounter++}`;
        }
      }
    }
  }

  /** 替换变量名为安全名称 */
  function parseSafeExpression(expression: string): string {
    let safeExpression = expression;
    const sortedVars = Object.keys(varMap)
      .filter((name) => variables[name] !== undefined)
      .sort((a, b) => b.length - a.length);

    for (const varName of sortedVars) {
      const tokens: string[] = [];
      let currentToken = '';
      let inVariable = false;

      for (let i = 0; i <= safeExpression.length; i++) {
        const char = i < safeExpression.length ? safeExpression[i] : '';
        if (/[a-zA-Z0-9_一-龥]/.test(char || '')) {
          currentToken += char;
          inVariable = true;
        } else {
          if (currentToken) {
            tokens.push(inVariable && currentToken === varName ? varMap[varName]! : currentToken);
            currentToken = '';
            inVariable = false;
          }
          if (char) tokens.push(char);
        }
      }
      safeExpression = tokens.join('');
    }
    return safeExpression;
  }

  /** 获取安全作用域 */
  function getSafeScope(): Record<string, unknown> {
    const scope: Record<string, unknown> = {};
    for (const [name, safeVarName] of Object.entries(varMap)) {
      if (variables[name] !== undefined) {
        scope[safeVarName] = variables[name];
      }
    }
    return scope;
  }

  /** 计算表达式 */
  function evalExpression(expression: string): unknown {
    const safeExpr = parseSafeExpression(expression);
    const scope = getSafeScope();
    return mathInstance.evaluate(safeExpr, scope);
  }

  /** 计算单行 */
  function calculateLine(line: string): LineResult {
    // 标题
    if (line.startsWith('# '))
      return { line, type: 'title', result: null, error: null, isCorrect: null, variable: null };
    if (line.startsWith('## '))
      return { line, type: 'subtitle', result: null, error: null, isCorrect: null, variable: null };
    if (line.trim() === '')
      return { line, type: 'empty', result: null, error: null, isCorrect: null, variable: null };
    if (line.startsWith('//'))
      return { line, type: 'comment', result: null, error: null, isCorrect: null, variable: null };

    // 变量赋值
    const assignmentMatch = line.match(/^([a-zA-Z0-9_一-龥]+)\s*=\s*(.+)$/);
    if (assignmentMatch) {
      const varName = assignmentMatch[1]?.trim() ?? '';
      const expression = assignmentMatch[2]?.trim() || '';
      if (!expression.includes('=')) {
        try {
          const result = evalExpression(expression);
          variables[varName] = result;
          const resultDisplay = formatResult(result, mathInstance, showPrecision);
          return {
            line,
            type: 'assignment',
            result: resultDisplay,
            error: null,
            isCorrect: null,
            variable: varName,
          };
        } catch (e: unknown) {
          return { line, type: 'error', result: null, error: String(e), isCorrect: null, variable: null };
        }
      }
    }

    // 等式验证
    const equalsMatch = line.match(/^(.+)=(.+)$/);
    if (equalsMatch) {
      const leftExpression = equalsMatch[1]?.trim() ?? '';
      const rightExpression = equalsMatch[2]?.trim() || '';
      if (!/^[a-zA-Z0-9_一-龥]+$/.test(leftExpression)) {
        try {
          const leftResult = evalExpression(leftExpression);
          const leftDisplay = formatResult(leftResult, mathInstance, showPrecision);
          const isRightNumeric = /^\s*\d+(\.\d+)?\s*$/.test(rightExpression);
          if (isRightNumeric) {
            const rightValue = Number.parseFloat(rightExpression);
            const isCorrect = Math.abs(toNumber(leftResult) - rightValue) < 1e-10;
            return { line, type: 'equation', result: leftDisplay, error: null, isCorrect, variable: null };
          }
          const rightResult = evalExpression(rightExpression);
          const isCorrect = Math.abs(toNumber(leftResult) - toNumber(rightResult)) < 1e-10;
          return { line, type: 'equation', result: leftDisplay, error: null, isCorrect, variable: null };
        } catch (e: unknown) {
          return { line, type: 'error', result: null, error: String(e), isCorrect: null, variable: null };
        }
      }
    }

    // 单位转换
    const unitConvMatch = line.match(/^(.+)\s+to\s+([a-zA-Z]+)$/);
    if (unitConvMatch) {
      const varName = unitConvMatch[1]?.trim() ?? '';
      try {
        if (variables[varName] !== undefined) {
          const converted = evalExpression(line);
          const resultDisplay = formatResult(converted, mathInstance, showPrecision);
          return { line, type: 'unitConversion', result: resultDisplay, error: null, isCorrect: null, variable: null };
        }
        return {
          line,
          type: 'error',
          result: null,
          error: `变量${varName}未定义`,
          isCorrect: null,
          variable: null,
        };
      } catch (e: unknown) {
        return { line, type: 'error', result: null, error: String(e), isCorrect: null, variable: null };
      }
    }

    // 普通表达式
    try {
      const result = evalExpression(line);
      const resultDisplay = formatResult(result, mathInstance, showPrecision);
      return { line, type: 'expression', result: resultDisplay, error: null, isCorrect: null, variable: null };
    } catch {
      return { line, type: 'normal', result: null, error: null, isCorrect: null, variable: null };
    }
  }

  // 初始化变量映射
  initVarMap();

  // 逐行计算
  const results: LineResult[] = [];
  for (const line of lines) {
    results.push(calculateLine(line || ''));
  }

  return { results };
}
