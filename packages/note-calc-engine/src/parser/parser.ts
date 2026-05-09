import type { Token, TokenType } from './tokenizer';

/** AST 节点类型 */
export type ASTNode =
  | NumberNode
  | VariableNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode
  | PercentNode
  | UnitNode
  | ConvertNode;

/** 数字字面量 */
export interface NumberNode {
  type: 'number';
  value: number;
}

/** 变量引用 */
export interface VariableNode {
  type: 'variable';
  name: string;
}

/** 二元运算 */
export interface BinaryOpNode {
  type: 'binaryOp';
  operator: '+' | '-' | '*' | '/' | '^';
  left: ASTNode;
  right: ASTNode;
}

/** 一元运算 */
export interface UnaryOpNode {
  type: 'unaryOp';
  operator: '+' | '-';
  operand: ASTNode;
}

/** 函数调用 */
export interface FunctionCallNode {
  type: 'functionCall';
  name: string;
  args: ASTNode[];
}

/** 百分比 */
export interface PercentNode {
  type: 'percent';
  value: ASTNode;
}

/** 数字 + 单位 */
export interface UnitNode {
  type: 'unit';
  value: ASTNode;
  unit: string;
}

/** 单位转换: expr to unit */
export interface ConvertNode {
  type: 'convert';
  value: ASTNode;
  targetUnit: string;
}

/** 最大 AST 嵌套深度 */
const MAX_DEPTH = 30;

/** 递归下降解析器 */
export class Parser {
  private tokens: Token[];
  private pos: number;
  private depth: number;

  private constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
    this.depth = 0;
  }

  /** 解析表达式为 AST */
  static parse(tokens: Token[]): ASTNode {
    const parser = new Parser(tokens);
    const ast = parser.parseExpression();
    if (parser.current().type !== 'EOF') {
      const tok = parser.current();
      throw new Error(`意外的 token '${tok.value}' 在位置 ${tok.pos}`);
    }
    return ast;
  }

  private current(): Token {
    return this.tokens[this.pos]!;
  }

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private advance(): Token {
    const token = this.tokens[this.pos]!;
    this.pos++;
    return token;
  }

  private expect(type: TokenType, value?: string): Token {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(`期望 ${value ?? type}，得到 '${token.value}' 在位置 ${token.pos}`);
    }
    return this.advance();
  }

  private enterRecursion(): void {
    this.depth++;
    if (this.depth > MAX_DEPTH) {
      throw new Error(`表达式嵌套过深（最大 ${MAX_DEPTH} 层）`);
    }
  }

  private leaveRecursion(): void {
    this.depth--;
  }

  /** expression = conversion */
  private parseExpression(): ASTNode {
    return this.parseConversion();
  }

  /** conversion = addition ('to' UNIT)? — 最低优先级 */
  private parseConversion(): ASTNode {
    this.enterRecursion();
    const left = this.parseAddition();

    if (this.peek().type === 'TO') {
      this.advance(); /** 消费 'to' */
      /** 目标必须是单位 */
      const target = this.peek();
      if (target.type === 'UNIT' || target.type === 'IDENTIFIER') {
        const unitToken = this.advance();
        this.leaveRecursion();
        return { type: 'convert', value: left, targetUnit: unitToken.value };
      }
      throw new Error(`'to' 后面应该是单位，得到 '${target.value}' 在位置 ${target.pos}`);
    }

    this.leaveRecursion();
    return left;
  }

  /** addition = multiplication (('+' | '-') multiplication)* */
  private parseAddition(): ASTNode {
    this.enterRecursion();
    let left = this.parseMultiplication();

    while (this.peek().type === 'OPERATOR' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.advance().value as '+' | '-';
      const right = this.parseMultiplication();
      left = { type: 'binaryOp', operator: op, left, right };
    }

    this.leaveRecursion();
    return left;
  }

  /** multiplication = unary (('*' | '/') unary)* */
  private parseMultiplication(): ASTNode {
    this.enterRecursion();
    let left = this.parseUnary();

    while (this.peek().type === 'OPERATOR' && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.advance().value as '*' | '/';
      const right = this.parseUnary();
      left = { type: 'binaryOp', operator: op, left, right };
    }

    this.leaveRecursion();
    return left;
  }

  /** unary = ('+' | '-') unary | power */
  private parseUnary(): ASTNode {
    this.enterRecursion();
    if (this.peek().type === 'OPERATOR' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.advance().value as '+' | '-';
      const operand = this.parseUnary();
      this.leaveRecursion();
      return { type: 'unaryOp', operator: op, operand };
    }
    const result = this.parsePower();
    this.leaveRecursion();
    return result;
  }

  /** power = postfix ('^' unary)?  (右结合) */
  private parsePower(): ASTNode {
    this.enterRecursion();
    const base = this.parsePostfix();

    if (this.peek().type === 'OPERATOR' && this.peek().value === '^') {
      this.advance();
      const exp = this.parseUnary(); /** 右结合：递归调用 unary */
      this.leaveRecursion();
      return { type: 'binaryOp', operator: '^', left: base, right: exp };
    }

    this.leaveRecursion();
    return base;
  }

  /** postfix = primary ('%' | UNIT)? */
  private parsePostfix(): ASTNode {
    this.enterRecursion();
    let node = this.parsePrimary();

    /** 百分比后缀 */
    if (this.peek().type === 'PERCENT') {
      this.advance();
      node = { type: 'percent', value: node };
    }

    /** 单位后缀 */
    if (this.peek().type === 'UNIT') {
      const unitToken = this.advance();
      node = { type: 'unit', value: node, unit: unitToken.value };
    }

    this.leaveRecursion();
    return node;
  }

  /** primary = NUMBER | IDENTIFIER | IDENTIFIER '(' args ')' | '(' expression ')' */
  private parsePrimary(): ASTNode {
    this.enterRecursion();
    const token = this.peek();

    /** 数字 */
    if (token.type === 'NUMBER') {
      this.advance();
      const value = Number.parseFloat(token.value);
      this.leaveRecursion();
      return { type: 'number', value };
    }

    /** 标识符：可能是函数调用或变量 */
    if (token.type === 'IDENTIFIER') {
      this.advance();
      const name = token.value;

      /** 函数调用 */
      if (this.peek().type === 'LPAREN') {
        this.advance(); /** 消费 '(' */
        const args: ASTNode[] = [];

        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.peek().type === 'COMMA') {
            this.advance(); /** 消费 ',' */
            args.push(this.parseExpression());
          }
        }

        this.expect('RPAREN');
        this.leaveRecursion();
        return { type: 'functionCall', name, args };
      }

      /** 变量 */
      this.leaveRecursion();
      return { type: 'variable', name };
    }

    /** 括号分组 */
    if (token.type === 'LPAREN') {
      this.advance(); /** 消费 '(' */
      const expr = this.parseExpression();
      this.expect('RPAREN');
      this.leaveRecursion();
      return expr;
    }

    /** 单位（独立出现的单位名，如转换目标） */
    if (token.type === 'UNIT') {
      this.advance();
      this.leaveRecursion();
      return { type: 'variable', name: token.value };
    }

    throw new Error(`意外的 token '${token.value}' 在位置 ${token.pos}`);
  }
}
