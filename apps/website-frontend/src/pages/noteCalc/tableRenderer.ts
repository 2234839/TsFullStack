/**
 * 表格渲染工具
 * 用于在 NoteCalc 中渲染 Markdown 表格
 */

import type { TableData, TableRow, TableCell } from './types';

/**
 * 检测是否是表格行
 */
export function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

/**
 * 检测是否是表格分隔行（如 |---|---|）
 */
export function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:]+\|[\s\-:|]*$/.test(line.trim());
}

/**
 * 从表格行中提取单元格内容
 */
export function parseTableRow(line: string): string[] {
  return line
    .trim()
    .split('|')
    .map(cell => cell.trim())
    .filter((_, index, arr) => index > 0 && index < arr.length - 1);
}

/**
 * 检测是否是公式单元格
 */
export function isFormulaCell(content: string): boolean {
  return content.startsWith('=');
}

/**
 * 解析公式中的单元格引用（如 A1, B2）
 */
export function parseCellReferences(formula: string): string[] {
  const matches = formula.match(/[A-Z]\d+/g);
  return matches || [];
}

/**
 * 将列索引转换为字母（0 -> A, 1 -> B, ...）
 */
export function indexToColumn(index: number): string {
  let column = '';
  let i = index;
  while (i >= 0) {
    column = String.fromCharCode(65 + (i % 26)) + column;
    i = Math.floor(i / 26) - 1;
  }
  return column;
}

/**
 * 将字母转换为列索引（A -> 0, B -> 1, ...）
 */
export function columnToIndex(column: string): number {
  let index = 0;
  for (let i = 0; i < column.length; i++) {
    index = index * 26 + (column.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * 将单元格引用转换为行列索引（A1 -> {row: 0, col: 0}）
 */
export function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match || !match[1] || !match[2]) return null;
  
  const col = columnToIndex(match[1]);
  const row = parseInt(match[2]) - 1; // 1-based to 0-based
  
  return { row, col };
}

/**
 * 渲染表格数据为 HTML 字符串
 */
export function renderTableHTML(tableData: TableData): string {
  let html = '<table class="note-calc-table">';
  
  tableData.rows.forEach((row, rowIndex) => {
    html += '<tr>';
    row.cells.forEach((cell) => {
      const tag = rowIndex === 0 ? 'th' : 'td';
      const classes = [];
      
      if (cell.isFormula) classes.push('formula-cell');
      if (cell.error) classes.push('error-cell');
      
      html += `<${tag} class="${classes.join(' ')}">`;
      
      if (cell.error) {
        html += `<span class="error">${cell.error}</span>`;
      } else if (cell.calculatedValue !== undefined && cell.isFormula) {
        html += `<span class="result">${cell.calculatedValue}</span>`;
        html += `<span class="formula">${cell.value}</span>`;
      } else {
        html += cell.value;
      }
      
      html += `</${tag}>`;
    });
    html += '</tr>';
  });
  
  html += '</table>';
  return html;
}

/**
 * 创建表格数据
 */
export function createTableData(lines: string[]): TableData {
  const rows: TableRow[] = [];
  let hasFormulas = false;
  
  lines.forEach(line => {
    if (isTableSeparator(line)) return; // 跳过分隔行
    
    const cells = parseTableRow(line);
    const row: TableRow = {
      cells: cells.map(content => {
        const isFormula = isFormulaCell(content);
        if (isFormula) hasFormulas = true;
        
        return {
          value: content,
          isFormula,
          calculatedValue: undefined,
          error: undefined,
        };
      }),
    };
    
    rows.push(row);
  });
  
  return { rows, hasFormulas };
}
