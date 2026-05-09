import { findUnit } from './definitions';

/** 带单位的值 */
export interface UnitValue {
  /** 数值（以基准单位表示） */
  value: number;
  /** 原始单位名 */
  unit: string;
}

/** 将值从一个单位转换到另一个单位 */
export function convertUnit(value: number, fromUnit: string, toUnit: string): UnitValue {
  const from = findUnit(fromUnit);
  const to = findUnit(toUnit);

  if (!from) throw new Error(`未知单位: ${fromUnit}`);
  if (!to) throw new Error(`未知单位: ${toUnit}`);
  if (from.category !== to.category) {
    throw new Error(`无法从 ${fromUnit}(${from.category}) 转换到 ${toUnit}(${to.category})`);
  }

  const baseValue = from.toBase(value);
  const result = to.fromBase(baseValue);

  return { value: result, unit: to.name };
}

/** 格式化带单位的值 */
export function formatUnitValue(unitValue: UnitValue, precision: number): string {
  const formatted = formatNumber(unitValue.value, precision);
  return `${formatted} ${unitValue.unit}`;
}

/** 格式化数字，控制精度 */
export function formatNumber(value: number, precision: number): string {
  if (Number.isInteger(value)) return String(value);
  if (Math.abs(value) >= 1e15 || (Math.abs(value) < 1e-10 && value !== 0)) {
    return value.toExponential(precision - 1);
  }
  const factor = Math.pow(10, precision);
  const rounded = Math.round(value * factor) / factor;
  return String(rounded);
}

/** 检查是否是 UnitValue */
export function isUnitValue(v: unknown): v is UnitValue {
  return typeof v === 'object' && v !== null && 'value' in v && 'unit' in v;
}
