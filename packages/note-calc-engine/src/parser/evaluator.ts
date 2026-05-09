import type { ASTNode } from './parser';
import { MATH_FUNCTIONS, MATH_CONSTANTS } from '../functions';
import { findUnit } from '../units/definitions';
import { convertUnit, formatNumber, isUnitValue, type UnitValue } from '../units/converter';

/** 求值作用域 */
export type Scope = Record<string, number | UnitValue>;

/** 求值结果 */
export type EvalResult = number | UnitValue;

/** 递归求值 AST */
export function evaluate(node: ASTNode, scope: Scope): EvalResult {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'variable': {
      /** 先查常量 */
      if (node.name in MATH_CONSTANTS) {
        return MATH_CONSTANTS[node.name]!;
      }
      /** 再查作用域 */
      if (node.name in scope) {
        return scope[node.name]!;
      }
      throw new Error(`未定义的变量: ${node.name}`);
    }

    case 'binaryOp': {
      const left = evaluate(node.left, scope);
      const right = evaluate(node.right, scope);

      /** 单位参与的运算 */
      if (isUnitValue(left) || isUnitValue(right)) {
        return evaluateUnitBinaryOp(node.operator, left, right);
      }

      return evaluateBinaryOp(node.operator, left as number, right as number);
    }

    case 'unaryOp': {
      const operand = evaluate(node.operand, scope);
      if (isUnitValue(operand)) {
        const val = node.operator === '-' ? -operand.value : operand.value;
        return { value: val, unit: operand.unit } as UnitValue;
      }
      return node.operator === '-' ? -(operand as number) : (operand as number);
    }

    case 'functionCall': {
      const func = MATH_FUNCTIONS[node.name];
      if (!func) {
        throw new Error(`未知函数: ${node.name}`);
      }

      const args = node.args.map((arg) => {
        const result = evaluate(arg, scope);
        if (isUnitValue(result)) {
          throw new Error(`函数 ${node.name} 不支持带单位的参数`);
        }
        return result as number;
      });

      return func(...args);
    }

    case 'percent': {
      const val = evaluate(node.value, scope);
      if (isUnitValue(val)) {
        throw new Error('百分比不支持带单位的值');
      }
      return (val as number) / 100;
    }

    case 'unit': {
      const val = evaluate(node.value, scope);
      if (isUnitValue(val)) {
        /** 已经有单位，做单位转换 */
        return convertUnit(val.value, val.unit, node.unit);
      }
      /** 数字 + 单位 */
      const unitDef = findUnit(node.unit);
      if (!unitDef) {
        throw new Error(`未知单位: ${node.unit}`);
      }
      return { value: val as number, unit: unitDef.name } as UnitValue;
    }

    case 'convert': {
      const val = evaluate(node.value, scope);
      if (!isUnitValue(val)) {
        throw new Error(`没有单位，无法转换为 ${node.targetUnit}`);
      }
      return convertUnit(val.value, val.unit, node.targetUnit);
    }
  }
}

function evaluateBinaryOp(op: '+' | '-' | '*' | '/' | '^', left: number, right: number): number {
  switch (op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/':
      if (right === 0) throw new Error('除以零');
      return left / right;
    case '^': return Math.pow(left, right);
  }
}

function evaluateUnitBinaryOp(op: '+' | '-' | '*' | '/' | '^', left: EvalResult, right: EvalResult): EvalResult {
  const leftIsUnit = isUnitValue(left);
  const rightIsUnit = isUnitValue(right);

  if (leftIsUnit && rightIsUnit) {
    const lv = left as UnitValue;
    const rv = right as UnitValue;
    const leftDef = findUnit(lv.unit);
    const rightDef = findUnit(rv.unit);

    if (!leftDef || !rightDef) throw new Error('未知单位');

    if (leftDef.category !== rightDef.category) {
      throw new Error(`无法对 ${lv.unit} 和 ${rv.unit} 进行运算`);
    }

    /** 同类别单位运算：统一到基准单位 */
    const baseLeft = leftDef.toBase(lv.value);
    const baseRight = rightDef.toBase(rv.value);

    if (op === '+' || op === '-') {
      const result = op === '+' ? baseLeft + baseRight : baseLeft - baseRight;
      return { value: leftDef.fromBase(result), unit: lv.unit } as UnitValue;
    }

    if (op === '/') {
      /** 单位除以同类单位 = 无量纲数 */
      return baseLeft / baseRight;
    }

    throw new Error(`不支持对单位进行 '${op}' 运算`);
  }

  if (leftIsUnit) {
    const lv = left as UnitValue;
    const rv = right as number;
    switch (op) {
      case '*': return { value: lv.value * rv, unit: lv.unit } as UnitValue;
      case '/':
        if (rv === 0) throw new Error('除以零');
        return { value: lv.value / rv, unit: lv.unit } as UnitValue;
      default:
        throw new Error(`不支持对单位进行 '${op}' 运算`);
    }
  }

  if (rightIsUnit) {
    const rv = right as UnitValue;
    const lv = left as number;
    if (op === '*') {
      return { value: lv * rv.value, unit: rv.unit } as UnitValue;
    }
    throw new Error(`不支持对单位进行 '${op}' 运算`);
  }

  throw new Error('不应到达此处');
}

/** 格式化求值结果为字符串 */
export function formatEvalResult(result: EvalResult, showPrecision: number): string {
  if (isUnitValue(result)) {
    const formatted = formatNumber(result.value, showPrecision);
    return `${formatted} ${result.unit}`;
  }
  return formatNumber(result, showPrecision);
}
