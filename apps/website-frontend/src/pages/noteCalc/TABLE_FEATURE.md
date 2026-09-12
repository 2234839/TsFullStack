# NoteCalc 表格支持

## 功能概述

实现 NoteCalc 的表格计算功能，支持：
- ✅ Markdown 表格语法
- ✅ 单元格引用（A1, B2, C3...）
- ✅ 表格内公式计算
- ✅ 自动计算和更新

## 实现方案（方案 B）

### 核心文件

1. **tableCalculator.ts** - 表格计算核心逻辑
   - `parseCellReference()` - 解析单元格引用
   - `generateCellReference()` - 生成单元格引用
   - `parseMarkdownTable()` - 解析 Markdown 表格
   - `calculateTableCells()` - 计算表格单元格
   - `detectTables()` - 检测文本中的表格

2. **types.ts** - 类型定义（已更新）
   - `TableCellPosition` - 单元格位置
   - `TableCell` - 单元格
   - `Table` - 表格

3. **useCalculator.ts** - 主计算器（已集成）
   - 自动检测表格
   - 自动计算表格公式

### 使用示例

```markdown
| 项目 | 数量 | 单价 | 总价 |
|------|------|------|------|
| 苹果 | 10 | 5 | =B2*C2 |
| 香蕉 | 20 | 3 | =B3*C3 |
| 总计 | | | =D2+D3 |
```

**计算结果：**
- D2 = 10 * 5 = 50
- D3 = 20 * 3 = 60
- D4 = 50 + 60 = 110

### 单元格引用规则

- **列号：** A, B, C, ..., Z, AA, AB, ...
- **行号：** 1, 2, 3, ...
- **示例：** A1, B2, AA10

### 公式语法

- **公式标识：** 以 `=` 开头
- **单元格引用：** `=B2*C2`
- **数学运算：** `=A1+B1+C1`
- **函数调用：** `=sum(A1:A10)`（未来功能）

### 实现进度

- [x] 创建核心文件 `tableCalculator.ts`
- [x] 定义类型 `types.ts`
- [x] 集成到 `useCalculator.ts`
- [ ] 实现表格渲染组件
- [ ] 添加示例和文档
- [ ] 单元测试

## 技术架构

```
NoteCalc
  ├── useCalculator.ts (主计算器)
  ├── tableCalculator.ts (表格计算) ⭐ 新增
  ├── types.ts (类型定义) ⭐ 更新
  └── NoteCalcCore.vue (UI 组件)
```

## API 文档

### `parseCellReference(ref: string)`

解析单元格引用字符串。

```typescript
parseCellReference('A1')  // { row: 0, col: 0 }
parseCellReference('B2')  // { row: 1, col: 1 }
parseCellReference('AA10') // { row: 9, col: 26 }
```

### `generateCellReference(row: number, col: number)`

生成单元格引用字符串。

```typescript
generateCellReference(0, 0)   // 'A1'
generateCellReference(1, 1)   // 'B2'
generateCellReference(9, 26)  // 'AA10'
```

### `parseMarkdownTable(lines: string[], startLine: number)`

解析 Markdown 表格。

```typescript
const lines = [
  '| A | B | C |',
  '|---|---|---|',
  '| 1 | 2 | =A2+B2 |'
];
const table = parseMarkdownTable(lines, 0);
```

### `calculateTableCells(table: Table, calculateFunc)`

计算表格中的所有公式单元格。

```typescript
const results = calculateTableCells(table, (formula, context) => {
  // 使用 math.js 或其他计算引擎
  return math.evaluate(formula, context);
});
```

### `detectTables(lines: string[])`

检测文本中的所有表格。

```typescript
const tableLines = detectTables(lines);
// 返回表格起始行号数组
```

## 下一步

1. **UI 渲染** - 实现表格的可视化渲染
2. **添加更多公式支持** - sum, avg, max, min 等函数
3. **性能优化** - 大表格支持

---

**创建时间：** 2026-03-08
**作者：** goudan-agent 🐶
**相关 Issue：** #7
