/**
 * 表格计算器
 * 支持 Markdown 表格中的公式计算
 */

import type { TableData } from './types';

/**
 * 解析单元格引用（如 A1, B2）
 */
function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match || !match[1] || !match[2]) return null;

  const colStr = match[1];
  const row = parseInt(match[2]) - 1; // 1-based to 0-based

  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  col -= 1; // A=0, B=1, ...

  return { col, row };
}

/**
 * 获取单元格的值
 */
function getCellValue(
  tableData: TableData,
  row: number,
  col: number
): number | string {
  if (row < 0 || row >= tableData.rows.length) return 0;
  const tableRow = tableData.rows[row];
  if (!tableRow || col < 0 || col >= tableRow.cells.length) return 0;

  const cell = tableRow.cells[col];
  if (!cell) return 0;

  if (cell.isFormula && cell.calculatedValue !== undefined) {
    // 如果是公式单元格，返回计算后的值
    return typeof cell.calculatedValue === 'number'
      ? cell.calculatedValue
      : parseFloat(cell.calculatedValue as string) || 0;
  }

  // 否则返回解析后的数值
  return parseFloat(cell.value) || 0;
}

/**
 * 计算单个公式
 */
function calculateFormula(
  formula: string,
  tableData: TableData
): number | string {
  try {
    // 移除开头的 =
    let expression = formula.substring(1);

    // 替换单元格引用
    const cellRefs = expression.match(/[A-Z]\d+/g) || [];
    for (const ref of cellRefs) {
      const pos = parseCellRef(ref);
      if (pos) {
        const value = getCellValue(tableData, pos.row, pos.col);
        expression = expression.replace(ref, String(value));
      }
    }

    // 使用 Function 构造器计算（简单版本，后续可以用 math.js）
    // 注意：这里只是为了简单，实际生产环境应该用更安全的计算方式
    const result = new Function(`return ${expression}`)();

    // 返回数值结果
    if (typeof result === 'number') {
      return result;
    }
    return result;
  } catch (error) {
    return `#ERROR: ${error instanceof Error ? error.message : '计算错误'}`;
  }
}

/**
 * 构建依赖图并计算表格
 */
export function calculateTable(tableData: TableData): TableData {
  const result: TableData = {
    rows: tableData.rows.map(row => ({
      ...row,
      cells: row.cells.map(cell => ({ ...cell })),
    })),
    hasFormulas: tableData.hasFormulas,
  };

  if (!result.hasFormulas) {
    return result;
  }

  // 按顺序计算所有公式（简单实现，不考虑依赖顺序）
  // TODO: 实现依赖图和拓扑排序
  for (let rowIndex = 0; rowIndex < result.rows.length; rowIndex++) {
    const row = result.rows[rowIndex];
    if (!row) continue;

    for (let colIndex = 0; colIndex < row.cells.length; colIndex++) {
      const cell = row.cells[colIndex];
      if (!cell) continue;

      if (cell.isFormula) {
        cell.calculatedValue = calculateFormula(cell.value, result);
      }
    }
  }

  return result;
}
