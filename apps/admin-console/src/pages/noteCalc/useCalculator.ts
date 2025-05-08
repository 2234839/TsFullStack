import { all, create } from 'mathjs';
import { computed, reactive, ref } from 'vue';
import type { CalculationResult, CalculatorConfig, TextDiff } from './types';

/**
 * 计算器 Hook
 * @param initialConfig 初始配置
 * @returns 计算器相关的状态和方法
 */
export function useCalculator(initialConfig: CalculatorConfig) {
  // 状态
  const config = reactive<CalculatorConfig>({
    precision: initialConfig.precision,
    showPrecision: initialConfig.showPrecision,
  });

  const variables = reactive<Record<string, any>>({});
  const varMap = reactive<Record<string, string>>({});
  const dependencyGraph = reactive<Record<string, Set<number>>>({});
  const lineToVars = reactive<Record<number, Set<string>>>({});
  const lineResults = reactive<Record<number, CalculationResult>>({});
  const lineDefinedVars = reactive<Record<number, string>>({});
  const varCounter = ref(0);

  // 计算属性
  const mathInstance = computed(() => {
    return create(all, {
      number: 'number',
      precision: config.precision,
    });
  });

  /**
   * 更新配置
   */
  function updateConfig(newConfig: CalculatorConfig): void {
    config.precision = newConfig.precision;
    config.showPrecision = newConfig.showPrecision;
  }

  /**
   * 转义正则表达式中的特殊字符
   */
  function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 格式化结果为可显示的字符串，处理精度问题
   */
  function formatResult(result: any): string {
    if (result === null || result === undefined) {
      return 'undefined';
    }

    // 处理数字类型，解决浮点数精度问题
    if (typeof result === 'number') {
      try {
        // 检查是否是整数
        if (Number.isInteger(result)) {
          return String(result);
        }

        // 对于小数，使用math.format格式化，避免显示过多小数位
        return mathInstance.value.format(result, {
          precision: config.showPrecision,
          notation: 'auto',
        });
      } catch (e) {
        console.error('格式化数字失败:', e);
        return String(result);
      }
    }

    // 处理BigNumber类型
    if (
      result &&
      typeof result === 'object' &&
      result.constructor &&
      result.constructor.name === 'BigNumber'
    ) {
      return result.toString();
    }

    // 处理Unit对象
    if (typeof result === 'object') {
      if (result.hasOwnProperty('unit') || result.hasOwnProperty('value')) {
        try {
          // 如果单位对象包含数值，也需要格式化
          if (typeof result.value === 'number') {
            const formattedValue = mathInstance.value.format(result.value, {
              precision: 15,
              notation: 'auto',
            });
            // 尝试手动构建格式化的单位字符串
            if (result.unit && result.unit.toString) {
              return `${formattedValue} ${result.unit.toString()}`;
            }
          }
          return result.toString();
        } catch (e) {
          console.error('转换Unit对象为字符串失败:', e);
          return JSON.stringify(result);
        }
      }

      // 其他对象类型
      try {
        return JSON.stringify(result);
      } catch (e) {
        return '[复杂对象]';
      }
    }

    // 基本类型直接转换为字符串
    return String(result);
  }

  /**
   * 格式化大数字，添加千位分隔符
   */
  function formatLargeNumber(num: number | string): string {
    // 如果是字符串，尝试转换为数字
    const numValue = typeof num === 'string' ? Number.parseFloat(num) : num;

    // 如果不是有效数字，返回原始值
    if (isNaN(numValue)) return String(num);

    // 如果是大数字（超过1000），使用千位分隔符格式化
    if (Math.abs(numValue) >= 1000) {
      return numValue.toLocaleString('zh-CN');
    }

    // 否则返回原始数字
    return String(numValue);
  }

  /**
   * 高亮文本中的数字
   */
  function highlightSyntax(text: string): Array<{ text: string; isNumber: boolean }> {
    const parts: Array<{ text: string; isNumber: boolean }> = [];
    let lastIndex = 0;

    // 高亮数字
    const numberRegex = /\b\d+\.?\d*\b/g;
    let match: RegExpExecArray | null;

    // 创建一个临时字符串以保存正则表达式匹配结果
    const tempText = text.toString();

    while ((match = numberRegex.exec(tempText)) !== null) {
      if (match.index > lastIndex) {
        // 添加数字前的文本
        parts.push({
          text: tempText.substring(lastIndex, match.index),
          isNumber: false,
        });
      }
      // 添加高亮的数字
      parts.push({
        text: match[0],
        isNumber: true,
      });
      lastIndex = match.index + match[0].length;
    }

    // 添加剩余的文本
    if (lastIndex < tempText.length) {
      parts.push({
        text: tempText.substring(lastIndex),
        isNumber: false,
      });
    }

    // 如果没有匹配到任何内容，返回原始文本
    if (parts.length === 0) {
      parts.push({
        text: text,
        isNumber: false,
      });
    }

    return parts;
  }

  /**
   * 对变量名进行替换，避免中文变量名对 math.js 的影响
   */
  function paserSafeExpression(expression: string): string {
    let safeExpression = ` ${expression} `; // 在表达式前后添加空格，便于处理边界情况

    // 按照变量名长度降序排序，避免部分替换问题
    const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length);

    // 替换变量名为安全的变量名
    for (const name of sortedVars) {
      if (variables[name] !== undefined) {
        // 使用单词边界和空格来确保完整替换
        const regex = new RegExp(
          `([^\\p{L}\\p{N}_])(${escapeRegExp(name)})([^\\p{L}\\p{N}_])`,
          'gu',
        );
        safeExpression = safeExpression.replace(regex, (_, p1, _2, p3) => {
          return `${p1}${varMap[name]}${p3}`;
        });
      }
    }

    return safeExpression.trim(); // 移除添加的前后空格
  }

  /**
   * 获取安全的作用域对象
   */
  function getSafeScope(): Record<string, any> {
    const scope: Record<string, any> = {};
    for (const [name, safeVarName] of Object.entries(varMap)) {
      if (variables[name] !== undefined) {
        scope[safeVarName] = variables[name];
      }
    }
    return scope;
  }

  /**
   * 计算表达式
   */
  function evalExpression(expression: string): any {
    return mathInstance.value.evaluate(paserSafeExpression(expression), getSafeScope());
  }

  /**
   * 提取表达式中的变量
   */
  function extractVariables(expression: string): Set<string> {
    const vars = new Set<string>();
    const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length);

    for (const varName of sortedVars) {
      // 检查变量是否在表达式中使用
      const pattern = new RegExp(
        `(^|[^\\p{L}\\p{N}_])${escapeRegExp(varName)}([^\\p{L}\\p{N}_]|$)`,
        'gu',
      );
      if (pattern.test(expression)) {
        vars.add(varName);
      }
    }

    return vars;
  }

  /**
   * 更新依赖图
   */
  function updateDependencyGraph(lineIndex: number, usedVars: Set<string>): void {
    // 清除该行之前的依赖关系
    if (lineToVars[lineIndex]) {
      for (const varName of lineToVars[lineIndex]) {
        dependencyGraph[varName]?.delete(lineIndex);
      }
    }

    // 更新该行使用的变量
    lineToVars[lineIndex] = usedVars;

    // 更新依赖图
    for (const varName of usedVars) {
      if (!dependencyGraph[varName]) {
        dependencyGraph[varName] = new Set<number>();
      }
      dependencyGraph[varName].add(lineIndex);
    }
  }

  /**
   * 获取依赖于指定变量的所有行
   */
  function getDependentLines(varName: string): Set<number> {
    const dependentLines = new Set<number>();

    if (dependencyGraph[varName]) {
      for (const lineIndex of dependencyGraph[varName]) {
        dependentLines.add(lineIndex);

        // 如果这一行定义了新变量，递归查找依赖于这个新变量的行
        const definedVar = lineDefinedVars[lineIndex];
        if (definedVar) {
          const nestedDependents = getDependentLines(definedVar);
          for (const line of nestedDependents) {
            dependentLines.add(line);
          }
        }
      }
    }

    return dependentLines;
  }

  /**
   * 计算单行
   */
  function calculateLine(line: string, lineIndex: number): CalculationResult {
    // 处理标题
    if (line.startsWith('# ')) {
      return {
        type: 'title',
        content: line.substring(2),
      };
    }

    if (line.startsWith('## ')) {
      return {
        type: 'subtitle',
        content: line.substring(3),
      };
    }

    // 处理空行
    if (line.trim() === '') {
      return {
        type: 'empty',
        content: '',
      };
    }

    // 处理注释
    if (line.startsWith('//')) {
      return {
        type: 'comment',
        content: line,
      };
    }

    // 处理变量赋值
    const assignmentMatch = line.match(/^([^=]+)=(.+)$/);
    if (assignmentMatch) {
      const varName = assignmentMatch[1].trim();
      const expression = assignmentMatch[2].trim();

      try {
        // 提取表达式中使用的变量
        const usedVars = extractVariables(expression);
        updateDependencyGraph(lineIndex, usedVars);

        // 记录该行定义的变量
        lineDefinedVars[lineIndex] = varName;

        // 计算表达式
        const result = evalExpression(expression);

        // 存储变量值
        variables[varName] = result;

        // 格式化结果显示
        const resultDisplay = formatResult(result);

        // 检查是否是简单赋值（直接赋值一个数字）
        const isSimpleAssignment = /^\s*\d+(\.\d+)?\s*$/.test(expression.trim());

        // 为赋值表达式创建特殊的显示
        if (isSimpleAssignment) {
          // 如果是简单赋值，显示格式化的数字和变量类型
          const formattedNumber = formatLargeNumber(resultDisplay);
          return {
            type: 'assignment',
            content: line,
            result: resultDisplay,
            isLargeNumber: formattedNumber !== resultDisplay,
            formattedNumber: formattedNumber,
            highlightedContent: highlightSyntax(line),
          };
        } else {
          // 如果是复杂表达式，显示计算结果
          return {
            type: 'assignment',
            content: line,
            result: resultDisplay,
            highlightedContent: highlightSyntax(line),
          };
        }
      } catch (e: any) {
        console.error(`计算错误 (${line}):`, e);
        return {
          type: 'error',
          content: line,
          error: String(e),
          highlightedContent: highlightSyntax(line),
        };
      }
    }

    // 处理单位转换 (如 "距离 to m")
    const unitConvMatch = line.match(/^(.+)\s+to\s+([a-zA-Z]+)$/);
    if (unitConvMatch) {
      const varName = unitConvMatch[1].trim();

      try {
        // 提取表达式中使用的变量
        const usedVars = new Set<string>([varName]);
        updateDependencyGraph(lineIndex, usedVars);

        if (variables[varName] !== undefined) {
          // 转换单位
          const converted = evalExpression(line);
          const resultDisplay = formatResult(converted);

          return {
            type: 'unitConversion',
            content: line,
            result: resultDisplay,
            highlightedContent: highlightSyntax(line),
          };
        } else {
          return {
            type: 'error',
            content: line,
            error: `错误: 变量${varName}未定义`,
            highlightedContent: highlightSyntax(line),
          };
        }
      } catch (e) {
        return {
          type: 'error',
          content: line,
          error: String(e),
          highlightedContent: highlightSyntax(line),
        };
      }
    }

    // 处理普通表达式
    try {
      // 提取表达式中使用的变量
      const usedVars = extractVariables(line);
      updateDependencyGraph(lineIndex, usedVars);

      // 计算表达式
      const result = evalExpression(line);

      // 格式化结果显示
      const resultDisplay = formatResult(result);
      return {
        type: 'expression',
        content: line,
        result: resultDisplay,
        highlightedContent: highlightSyntax(line),
      };
    } catch (e) {
      // 如果不是表达式，就原样返回
      return {
        type: 'normal',
        content: line,
      };
    }
  }

  /**
   * 初始化变量映射
   */
  function initializeVarMap(content: string): void {
    const lines = content.split('\n');
    varCounter.value = 0;
    // 第一遍扫描：收集所有变量定义
    lines.forEach((line) => {
      const assignmentMatch = line.match(/^([^=]+)=(.+)$/);
      if (assignmentMatch) {
        const varName = assignmentMatch[1].trim();
        if (!varMap[varName]) {
          // 为每个变量创建一个唯一的安全名称，因为 math.js 不支持中文变量名
          varMap[varName] = `v${varCounter.value++}`;
        }
      }
    });
  }

  /**
   * 全量计算
   */
  async function calculateAll(content: string): Promise<CalculationResult[]> {
    const lines = content.split('\n');
    const results: CalculationResult[] = [];

    // 重置状态
    Object.keys(variables).forEach((key) => delete variables[key]);
    Object.keys(dependencyGraph).forEach((key) => delete dependencyGraph[key]);
    Object.keys(lineToVars).forEach((key) => delete lineToVars[Number(key)]);
    Object.keys(lineResults).forEach((key) => delete lineResults[Number(key)]);
    Object.keys(lineDefinedVars).forEach((key) => delete lineDefinedVars[Number(key)]);

    // 初始化变量映射
    initializeVarMap(content);

    // 处理每一行
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      /** 防止卡死ui */
      if (i % 10 === 0) await delay(1);

      const result = calculateLine(line, i);
      results.push(result);
      lineResults[i] = result;
    }

    return results;
  }

  /**
   * 智能检测文本变化
   */
  function detectTextChanges(prevText: string, newText: string): TextDiff[] {
    const prevLines = prevText.split('\n');
    const newLines = newText.split('\n');
    const diffs: TextDiff[] = [];

    // 使用最长公共子序列算法找出差异
    // 这里使用一个简化版本，只处理简单的插入、删除和修改

    // 如果行数相同，检查每行是否有修改
    if (prevLines.length === newLines.length) {
      for (let i = 0; i < prevLines.length; i++) {
        if (prevLines[i] !== newLines[i]) {
          diffs.push({
            type: 'modify',
            lineIndex: i,
            content: newLines[i],
          });
        }
      }
      return diffs;
    }

    // 如果新文本比旧文本多行，可能是插入了行
    if (newLines.length > prevLines.length) {
      // 找到第一个不同的行
      let diffIndex = 0;
      while (diffIndex < prevLines.length && prevLines[diffIndex] === newLines[diffIndex]) {
        diffIndex++;
      }

      // 检查是否是简单的插入（后续行保持不变）
      let isSimpleInsert = true;
      for (let i = diffIndex; i < prevLines.length; i++) {
        if (prevLines[i] !== newLines[i + 1]) {
          isSimpleInsert = false;
          break;
        }
      }

      if (isSimpleInsert) {
        // 简单插入一行
        diffs.push({
          type: 'insert',
          lineIndex: diffIndex,
          content: newLines[diffIndex],
        });
        return diffs;
      }
    }

    // 如果新文本比旧文本少行，可能是删除了行
    if (newLines.length < prevLines.length) {
      // 找到第一个不同的行
      let diffIndex = 0;
      while (diffIndex < newLines.length && prevLines[diffIndex] === newLines[diffIndex]) {
        diffIndex++;
      }

      // 检查是否是简单的删除（后续行保持不变）
      let isSimpleDelete = true;
      for (let i = diffIndex; i < newLines.length; i++) {
        if (prevLines[i + 1] !== newLines[i]) {
          isSimpleDelete = false;
          break;
        }
      }

      if (isSimpleDelete) {
        // 简单删除一行
        diffs.push({
          type: 'delete',
          lineIndex: diffIndex,
        });
        return diffs;
      }
    }

    // 如果不是简单的插入或删除，则标记所有行为修改
    // 这是一个保守的做法，确保所有变化都被处理
    const maxLength = Math.max(prevLines.length, newLines.length);
    for (let i = 0; i < maxLength; i++) {
      if (i < prevLines.length && i < newLines.length && prevLines[i] !== newLines[i]) {
        diffs.push({
          type: 'modify',
          lineIndex: i,
          content: newLines[i],
        });
      } else if (i >= prevLines.length) {
        diffs.push({
          type: 'insert',
          lineIndex: i,
          content: newLines[i],
        });
      } else if (i >= newLines.length) {
        diffs.push({
          type: 'delete',
          lineIndex: i,
        });
      }
    }

    return diffs;
  }

  /**
   * 增量计算
   */
  async function calculateIncremental(
    prevContent: string,
    newContent: string,
  ): Promise<CalculationResult[]> {
    // 如果内容相同，直接返回
    if (prevContent === newContent) {
      return Object.values(lineResults);
    }

    // 检测文本变化
    const diffs = detectTextChanges(prevContent, newContent);
    console.log('检测到的变化:', diffs);

    if (diffs.length === 0) {
      return Object.values(lineResults);
    }

    const newLines = newContent.split('\n');
    const linesToRecalculate = new Set<number>();

    // 处理每个变化
    for (const diff of diffs) {
      switch (diff.type) {
        case 'insert':
          // 插入行只需要计算新行
          linesToRecalculate.add(diff.lineIndex);

          // 更新后续行的索引
          updateLineIndices(diff.lineIndex, 1);
          break;

        case 'delete':
          // 删除行需要找出依赖于该行定义的变量的所有行
          const deletedVar = lineDefinedVars[diff.lineIndex];
          if (deletedVar) {
            const dependentLines = getDependentLines(deletedVar);
            for (const line of dependentLines) {
              if (line > diff.lineIndex) {
                // 调整行号（因为删除了一行）
                linesToRecalculate.add(line - 1);
              } else if (line < diff.lineIndex) {
                linesToRecalculate.add(line);
              }
            }

            // 删除变量
            delete variables[deletedVar];
          }

          // 删除行相关的记录
          delete lineResults[diff.lineIndex];
          delete lineDefinedVars[diff.lineIndex];
          if (lineToVars[diff.lineIndex]) {
            delete lineToVars[diff.lineIndex];
          }

          // 更新后续行的索引
          updateLineIndices(diff.lineIndex, -1);
          break;

        case 'modify':
          // 修改行需要重新计算该行和依赖于该行的所有行
          linesToRecalculate.add(diff.lineIndex);

          // 如果该行定义了变量，找出所有依赖该变量的行
          const modifiedVar = lineDefinedVars[diff.lineIndex];
          if (modifiedVar) {
            const dependentLines = getDependentLines(modifiedVar);
            for (const line of dependentLines) {
              linesToRecalculate.add(line);
            }
          }
          break;
      }
    }

    // 更新变量映射（可能有新变量）
    initializeVarMap(newContent);

    console.log('需要重新计算的行:', Array.from(linesToRecalculate));

    // 重新计算受影响的行
    for (const lineIndex of linesToRecalculate) {
      if (lineIndex < newLines.length) {
        const line = newLines[lineIndex];
        /** 防止卡死ui */
        if (lineIndex % 10 === 0) await delay(1);

        const result = calculateLine(line, lineIndex);
        lineResults[lineIndex] = result;
      }
    }

    // 构建结果数组
    const results: CalculationResult[] = [];
    for (let i = 0; i < newLines.length; i++) {
      if (lineResults[i]) {
        results.push(lineResults[i]);
      } else {
        // 如果没有计算结果（可能是新增的行），计算它
        const line = newLines[i];
        const result = calculateLine(line, i);
        lineResults[i] = result;
        results.push(result);
      }
    }

    return results;
  }

  /**
   * 更新行索引（插入或删除行后）
   */
  function updateLineIndices(startIndex: number, offset: number): void {
    // 更新行到变量的映射
    const newLineToVars: Record<number, Set<string>> = {};
    for (const [lineStr, vars] of Object.entries(lineToVars)) {
      const line = Number.parseInt(lineStr);
      if (line >= startIndex) {
        newLineToVars[line + offset] = vars;
      } else {
        newLineToVars[line] = vars;
      }
    }

    // 清空原对象
    Object.keys(lineToVars).forEach((key) => delete lineToVars[Number(key)]);
    // 填充新值
    Object.entries(newLineToVars).forEach(([key, value]) => {
      lineToVars[Number.parseInt(key)] = value;
    });

    // 更新行定义的变量
    const newLineDefinedVars: Record<number, string> = {};
    for (const [lineStr, varName] of Object.entries(lineDefinedVars)) {
      const line = Number.parseInt(lineStr);
      if (line >= startIndex) {
        newLineDefinedVars[line + offset] = varName;
      } else {
        newLineDefinedVars[line] = varName;
      }
    }

    // 清空原对象
    Object.keys(lineDefinedVars).forEach((key) => delete lineDefinedVars[Number(key)]);
    // 填充新值
    Object.entries(newLineDefinedVars).forEach(([key, value]) => {
      lineDefinedVars[Number.parseInt(key)] = value;
    });

    // 更新行结果
    const newLineResults: Record<number, CalculationResult> = {};
    for (const [lineStr, result] of Object.entries(lineResults)) {
      const line = Number.parseInt(lineStr);
      if (line >= startIndex) {
        newLineResults[line + offset] = result;
      } else {
        newLineResults[line] = result;
      }
    }

    // 清空原对象
    Object.keys(lineResults).forEach((key) => delete lineResults[Number(key)]);
    // 填充新值
    Object.entries(newLineResults).forEach(([key, value]) => {
      lineResults[Number.parseInt(key)] = value;
    });

    // 更新依赖图
    for (const varName in dependencyGraph) {
      const newDependents = new Set<number>();
      for (const line of dependencyGraph[varName]) {
        if (line >= startIndex) {
          newDependents.add(line + offset);
        } else {
          newDependents.add(line);
        }
      }
      dependencyGraph[varName] = newDependents;
    }
  }

  /**
   * 延迟函数，防止UI卡死
   */
  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 返回需要在组件中使用的状态和方法
  return {
    // 状态
    config,

    // 方法
    updateConfig,
    calculateAll,
    calculateIncremental,
    detectTextChanges,
    initializeVarMap,
  };
}
