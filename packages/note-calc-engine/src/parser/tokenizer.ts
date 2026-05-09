import { getUnitNames } from '../units/definitions';
import { MATH_FUNCTIONS } from '../functions';

/** Token 类型 */
export type TokenType =
  | 'NUMBER'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'PERCENT'
  | 'UNIT'
  | 'TO'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

/** Token */
export interface Token {
  type: TokenType;
  /** 字面值 */
  value: string;
  /** 在表达式中的位置 */
  pos: number;
}

/** 单位名集合（缓存） */
let cachedUnitNames: string[] | null = null;

function getUnitNamesCached(): string[] {
  if (!cachedUnitNames) {
    cachedUnitNames = getUnitNames();
  }
  return cachedUnitNames;
}

/** 最大 token 数量限制（防止超长表达式 DoS） */
const MAX_TOKENS = 500;

/** 将表达式字符串转换为 Token 流 */
export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  const unitNames = getUnitNamesCached();
  const funcNames = Object.keys(MATH_FUNCTIONS);
  let pos = 0;

  while (pos < expression.length) {
    /** 跳过空白 */
    if (/\s/.test(expression[pos]!)) {
      pos++;
      continue;
    }

    const char = expression[pos]!;

    /** 数字字面量 */
    if (/[0-9]/.test(char) || (char === '.' && pos + 1 < expression.length && /[0-9]/.test(expression[pos + 1]!))) {
      const start = pos;
      let hasDot = false;
      while (pos < expression.length && (/[0-9]/.test(expression[pos]!) || (expression[pos] === '.' && !hasDot))) {
        if (expression[pos] === '.') hasDot = true;
        pos++;
      }
      tokens.push({ type: 'NUMBER', value: expression.slice(start, pos), pos: start });
      continue;
    }

    /** 标识符（变量名、函数名、常量）或单位 */
    if (/[a-zA-Z_一-龥]/.test(char)) {
      const start = pos;
      while (pos < expression.length && /[a-zA-Z0-9_一-龥]/.test(expression[pos]!)) {
        pos++;
      }
      const word = expression.slice(start, pos);

      /** 检查后面是否紧跟单位（数字后的标识符优先识别为单位） */
      if (tokens.length > 0 && tokens[tokens.length - 1]!.type === 'NUMBER') {
        const unitMatch = unitNames.find((u) => u.toLowerCase() === word.toLowerCase());
        if (unitMatch) {
          tokens.push({ type: 'UNIT', value: unitMatch, pos: start });
          continue;
        }
      }

      /** 不是函数名也不是常量的标识符，检查是否为 to 关键字 */
      if (word === 'to' || word === 'TO' || word === 'To') {
        tokens.push({ type: 'TO', value: 'to', pos: start });
        continue;
      }

      /** 不是函数名也不是常量的标识符，检查是否为单位（单独出现的单位名） */
      const isFunc = funcNames.includes(word);
      if (!isFunc) {
        const unitMatch = unitNames.find((u) => u.toLowerCase() === word.toLowerCase());
        if (unitMatch) {
          tokens.push({ type: 'UNIT', value: unitMatch, pos: start });
          continue;
        }
      }

      tokens.push({ type: 'IDENTIFIER', value: word, pos: start });
      continue;
    }

    /** 百分号 */
    if (char === '%') {
      tokens.push({ type: 'PERCENT', value: '%', pos });
      pos++;
      continue;
    }

    /** 运算符 */
    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '^') {
      tokens.push({ type: 'OPERATOR', value: char, pos });
      pos++;
      continue;
    }

    /** 括号 */
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos });
      pos++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos });
      pos++;
      continue;
    }

    /** 逗号 */
    if (char === ',') {
      tokens.push({ type: 'COMMA', value: ',', pos });
      pos++;
      continue;
    }

    /** 无法识别的字符 */
    throw new Error(`无法识别的字符 '${char}' 在位置 ${pos}`);
  }

  if (tokens.length > MAX_TOKENS) {
    throw new Error(`表达式过于复杂，最多支持 ${MAX_TOKENS} 个 token`);
  }

  tokens.push({ type: 'EOF', value: '', pos });
  return tokens;
}
