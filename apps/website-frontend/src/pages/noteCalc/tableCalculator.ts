/**
 * 表格计算器
 * 支持 Markdown 表格中的公式计算
 */

import type { TableData } from './types';

/**
 * 计算表格
 */
export function calculateTable(tableData: TableData): TableData {
  // 暂时返回原数据，后续实现完整计算逻辑
  return {
    ...tableData,
    rows: tableData.rows.map((row, rowIndex) => ({
      ...row,
      cells: row.cells.map((cell) => {
        if (cell.isFormula) {
          // 简单示例：直接返回公式字符串
          return {
            ...cell,
            calculatedValue: `[${cell.value}]`,
          };
        }
        return cell;
      }),
    })),
  };
}
