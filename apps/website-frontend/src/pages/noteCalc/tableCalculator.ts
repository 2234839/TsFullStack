import type { CalculationResult } from './types';

/**
 * 表格单元格位置
 */
export interface TableCellPosition {
  row: number;      // 行号（0-based）
  col: number;      // 列号（0-based）
  tableId: string;  // 表格 ID
}

/**
 * 表格单元格
 */
export interface TableCell {
  position: TableCellPosition;
  rawContent: string;      // 原始内容
  formula?: string;        // 公式（如果有）
  value?: any;            // 计算结果
  references?: string[];  // 引用的其他单元格（如 A1, B2）
}

/**
 * 表格
 */
export interface Table {
  id: string;
  rows: number;
  cols: number;
  cells: TableCell[][];
  startLine: number;  // 表格在文档中的起始行号
  endLine: number;    // 表格在文档中的结束行号
}

/**
 * 解析单元格引用（如 A1, B2, AA10）
 * @param ref 单元格引用字符串
 * @returns 行列索引（0-based）
 */
export function parseCellReference(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const colStr = match[1];
  const rowStr = match[2];

  // 将列字母转换为数字（A=0, B=1, ..., Z=25, AA=26, ...）
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  col -= 1; // 转换为 0-based

  // 行号直接转换（1-based 转 0-based）
  const row = parseInt(rowStr, 10) - 1;

  return { row, col };
}

/**
 * 生成单元格引用（如 0,0 -> A1）
 * @param row 行号（0-based）
 * @param col 列号（0-based）
 * @returns 单元格引用字符串
 */
export function generateCellReference(row: number, col: number): string {
  let colStr = '';
  let tempCol = col + 1;

  while (tempCol > 0) {
    const remainder = (tempCol - 1) % 26;
    colStr = String.fromCharCode(65 + remainder) + colStr;
    tempCol = Math.floor((tempCol - 1) / 26);
  }

  return `${colStr}${row + 1}`;
}

/**
 * 解析 Markdown 表格
 * @param lines 文本行数组
 * @param startLine 表格起始行号
 * @returns Table 对象
 */
export function parseMarkdownTable(lines: string[], startLine: number): Table | null {
  const tableId = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const tableLines: string[] = [];

  // 找到表格的结束行
  let endLine = startLine;
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      tableLines.push(line);
      endLine = i;
    } else {
      break;
    }
  }

  // 至少需要 3 行（表头 + 分隔符 + 数据）
  if (tableLines.length < 3) return null;

  // 跳过分隔符行（第 2 行）
  const dataLines = [tableLines[0], ...tableLines.slice(2)];

  // 解析列数
  const firstRowCells = parseTableRow(dataLines[0]);
  const cols = firstRowCells.length;
  const rows = dataLines.length;

  // 创建表格
  const cells: TableCell[][] = [];

  for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
    cells[rowIdx] = [];
    const rowCells = parseTableRow(dataLines[rowIdx]);

    for (let colIdx = 0; colIdx < cols; colIdx++) {
      const rawContent = rowCells[colIdx] || '';
      const cell: TableCell = {
        position: { row: rowIdx, col: colIdx, tableId },
        rawContent,
        references: extractCellReferences(rawContent),
      };

      // 检查是否是公式（以 = 开头）
      if (rawContent.trim().startsWith('=')) {
        cell.formula = rawContent.trim().substring(1);
      }

      cells[rowIdx][colIdx] = cell;
    }
  }

  return {
    id: tableId,
    rows,
    cols,
    cells,
    startLine,
    endLine,
  };
}

/**
 * 解析表格行
 * @param line 文本行
 * @returns 单元格内容数组
 */
function parseTableRow(line: string): string[] {
  // 移除首尾的 |
  const trimmed = line.trim().replace(/^\||\|$/g, '');
  // 按 | 分割
  return trimmed.split('|').map(cell => cell.trim());
}

/**
 * 提取单元格引用
 * @param content 单元格内容
 * @returns 引用的单元格列表
 */
function extractCellReferences(content: string): string[] {
  const refs: string[] = [];
  const regex = /\b([A-Z]+\d+)\b/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    refs.push(match[1]);
  }

  return refs;
}

/**
 * 计算表格单元格
 * @param table 表格对象
 * @param calculateFunc 计算函数
 * @returns 计算结果
 */
export function calculateTableCells(
  table: Table,
  calculateFunc: (formula: string, context: Record<string, any>) => any
): Map<string, CalculationResult> {
  const results = new Map<string, CalculationResult>();
  const context: Record<string, any> = {};

  // 第一遍：收集所有单元格的值
  for (let rowIdx = 0; rowIdx < table.rows; rowIdx++) {
    for (let colIdx = 0; colIdx < table.cols; colIdx++) {
      const cell = table.cells[rowIdx][colIdx];
      const cellRef = generateCellReference(rowIdx, colIdx);

      if (!cell.formula) {
        // 非公式单元格，直接使用原始内容
        context[cellRef] = cell.rawContent;
      }
    }
  }

  // 第二遍：计算公式单元格
  for (let rowIdx = 0; rowIdx < table.rows; rowIdx++) {
    for (let colIdx = 0; colIdx < table.cols; colIdx++) {
      const cell = table.cells[rowIdx][colIdx];
      const cellRef = generateCellReference(rowIdx, colIdx);

      if (cell.formula) {
        try {
          const value = calculateFunc(cell.formula, context);
          context[cellRef] = value;
          results.set(cellRef, {
            type: 'expression',
            content: cell.formula,
            result: String(value),
          } as CalculationResult);
        } catch (error) {
          results.set(cellRef, {
            type: 'error',
            content: cell.formula,
            error: error instanceof Error ? error.message : '计算失败',
          } as CalculationResult);
        }
      }
    }
  }

  return results;
}

/**
 * 检测文本中是否包含表格
 * @param lines 文本行数组
 * @returns 表格起始行号数组
 */
export function detectTables(lines: string[]): number[] {
  const tableStartLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // 检测表格起始（以 | 开头和结尾）
    if (line.startsWith('|') && line.endsWith('|')) {
      // 检查是否是新表格的开始
      if (i === 0 || !lines[i - 1].trim().startsWith('|')) {
        tableStartLines.push(i);
      }
    }
  }

  return tableStartLines;
}
