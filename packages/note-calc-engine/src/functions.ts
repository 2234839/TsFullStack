/** 安全的数学函数白名单 */
export const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  /** 平方根 */
  sqrt: (x) => Math.sqrt(x),
  /** 立方根 */
  cbrt: (x) => Math.cbrt(x),
  /** 绝对值 */
  abs: (x) => Math.abs(x),
  /** 符号 */
  sign: (x) => Math.sign(x),
  /** 向上取整 */
  ceil: (x) => Math.ceil(x),
  /** 向下取整 */
  floor: (x) => Math.floor(x),
  /** 四舍五入 */
  round: (x) => Math.round(x),
  /** 正弦 */
  sin: (x) => Math.sin(x),
  /** 余弦 */
  cos: (x) => Math.cos(x),
  /** 正切 */
  tan: (x) => Math.tan(x),
  /** 反正弦 */
  asin: (x) => Math.asin(x),
  /** 反余弦 */
  acos: (x) => Math.acos(x),
  /** 反正切 */
  atan: (x) => Math.atan(x),
  /** 双参数反正切 */
  atan2: (y, x) => Math.atan2(y, x),
  /** 自然对数 */
  log: (x) => Math.log(x),
  /** 以 2 为底对数 */
  log2: (x) => Math.log2(x),
  /** 以 10 为底对数 */
  log10: (x) => Math.log10(x),
  /** 指数函数 e^x */
  exp: (x) => Math.exp(x),
  /** 幂运算 */
  pow: (base, exp) => Math.pow(base, exp),
  /** 最大值 */
  max: (...args) => Math.max(...args),
  /** 最小值 */
  min: (...args) => Math.min(...args),
  /** 取模 */
  mod: (a, b) => a % b,
};

/** 数学常量白名单 */
export const MATH_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
};
