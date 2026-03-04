<template>
  <div
    class="codemirror-editor"
    :class="editorClasses">
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <button
          class="toolbar-button"
          :class="{ active: config.isAutoCalculate }"
          :title="config.isAutoCalculate ? '关闭自动计算' : '开启自动计算'"
          @click="toggleAutoCalculate">
          <i class="pi" :class="config.isAutoCalculate ? 'pi-check' : 'pi-times'" />
          <span>自动计算</span>
        </button>
      </div>

      <div class="toolbar-right">
        <div v-if="calculator.isCalculating.value" class="calculation-status">
          <ProgressSpinner class="compact-spinner" />
          <span>计算中...</span>
        </div>

        <div v-else-if="lastCalculationTime" class="calculation-time">
          <span>上次计算: {{ lastCalculationTime_v }}</span>
        </div>
      </div>
    </div>

    <!-- CodeMirror 容器 -->
    <div ref="editorRef" class="editor-container"></div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref, watch, computed, shallowRef } from 'vue';
  import { EditorView, lineNumbers, drawSelection, dropCursor, keymap, Decoration, WidgetType } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
  import { useThrottleFn } from '@vueuse/core';
  import { useCalculator } from './useCalculator';
  import type { CalculationResult, CalculatorConfig } from './types';
  import ProgressSpinner from '@/components/base/ProgressSpinner.vue';

  interface Props {
    /** 模型值 */
    modelValue: string;
    /** 配置 */
    config: CalculatorConfig & { isAutoCalculate: boolean };
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    'update:modelValue': [content: string];
    'update:config': [config: CalculatorConfig];
  }>();

  /** 状态 */
  const editorRef = ref<HTMLElement>();
  const view = shallowRef<EditorView>();
  const lastCalculationTime = ref<Date | null>(null);
  const previousContent = ref('');

  /** 计算器实例 */
  const calculator = useCalculator({
    precision: props.config.precision,
    showPrecision: props.config.showPrecision,
  });

  /** 时间格式化 */
  const lastCalculationTime_v = computed(() => {
    if (!lastCalculationTime.value) return '';
    const date = lastCalculationTime.value;
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  });

  /** 编辑器样式 */
  const editorClasses = computed(() => {
    return {
      'codemirror-editor--has-content': props.modelValue.length > 0,
    };
  });

  /**
   * 结果 Widget 类
   */
  class ResultWidget extends WidgetType {
    constructor(
      public result: CalculationResult,
      public marginLeft: number = 16
    ) {
      super();
    }

    toDOM() {
      const span = document.createElement('span');
      span.className = 'result-widget';
      span.style.marginLeft = `${this.marginLeft}px`;

      // 根据结果类型设置样式
      if (this.result.type === 'error') {
        span.classList.add('result-widget--error');
        span.textContent = `错误: ${this.result.error}`;
      } else if (this.result.result) {
        // 成功结果
        if (this.result.type === 'assignment' || this.result.type === 'expression' || this.result.type === 'unitConversion') {
          span.classList.add('result-widget--success');
        } else if (this.result.type === 'equation' && this.result.isCorrect === false) {
          span.classList.add('result-widget--warning');
        } else {
          span.classList.add('result-widget--normal');
        }

        // 如果是大数字，只显示格式化的数字；否则显示原始数字
        if (this.result.isLargeNumber && this.result.formattedNumber) {
          span.innerHTML = `= ${this.result.formattedNumber}`;
        } else {
          span.innerHTML = `= ${this.result.result}`;
        }
      }

      return span;
    }

    ignoreEvent() {
      return false;
    }
  }

  /**
   * 计算结果状态
   */
  let currentResults: CalculationResult[] = [];

  /**
   * 装饰器扩展
   * 用于管理计算结果和语法高亮的显示
   */
  const decorationsExtension = EditorView.decorations.of((view: EditorView) => {
    const resultDecos = createResultDecorations(view.state.doc.toString(), currentResults);
    const highlightDecos = createSyntaxHighlightDecorations(view.state.doc.toString());
    // 将两个装饰数组合并并排序
    const allDecos = [...resultDecos, ...highlightDecos];
    // 按 from 位置排序，确保符合 CodeMirror 的要求
    allDecos.sort((a, b) => {
      const fromA = a.from ?? 0;
      const fromB = b.from ?? 0;
      if (fromA !== fromB) return fromA - fromB;
      // 如果 from 相同，按 to 排序
      const toA = a.to ?? 0;
      const toB = b.to ?? 0;
      return toA - toB;
    });
    return Decoration.set(allDecos);
  });

  /**
   * 创建语法高亮装饰器
   */
  function createSyntaxHighlightDecorations(content: string) {
    const decorations: any[] = [];
    const lines = content.split('\n');

    let pos = 0;

    for (const line of lines) {
      // 跳过空行
      if (line.trim() === '') {
        pos += line.length + 1;
        continue;
      }

      // 收集当前行的所有装饰器，稍后排序
      const lineDecorations: any[] = [];

      // 检查是否为标题（# 或 ## 开头）
      const titleMatch = line.match(/^(#{1,2})\s+(.*)/);
      if (titleMatch && titleMatch[1] && titleMatch[2] !== undefined) {
        const hashLength = titleMatch[1].length;
        const titleText = titleMatch[2];

        // 高亮 # 符号
        lineDecorations.push({
          from: pos,
          to: pos + hashLength,
          decoration: Decoration.mark({ class: hashLength === 1 ? 'syntax-h1-hash' : 'syntax-h2-hash' })
        });

        // 高亮标题文本
        lineDecorations.push({
          from: pos + hashLength + 1,
          to: pos + hashLength + 1 + titleText.length,
          decoration: Decoration.mark({ class: hashLength === 1 ? 'syntax-h1-text' : 'syntax-h2-text' })
        });
      } else if (!line.trim().startsWith('//')) {
        // 非注释行，高亮数字和变量

        // 高亮数字（包括小数点和科学计数法）
        const numberRegex = /\b\d+\.?\d*([eE][+-]?\d+)?\b/g;
        let match;
        while ((match = numberRegex.exec(line)) !== null) {
          const startPos = pos + match.index;
          const endPos = startPos + match[0].length;
          lineDecorations.push({
            from: startPos,
            to: endPos,
            decoration: Decoration.mark({ class: 'syntax-number' })
          });
        }

        // 高亮变量（中文、英文字母、下划线）
        const variableRegex = /[\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*/g;
        numberRegex.lastIndex = 0;
        while ((match = variableRegex.exec(line)) !== null) {
          const varName = match[0];

          // 跳过已经作为数字的部分和常见函数名
          if (!numberRegex.test(varName) && !['sin', 'cos', 'tan', 'log', 'sqrt', 'PI', 'to'].includes(varName)) {
            const startPos = pos + match.index;
            const endPos = startPos + varName.length;
            lineDecorations.push({
              from: startPos,
              to: endPos,
              decoration: Decoration.mark({ class: 'syntax-variable' })
            });
          }
          numberRegex.lastIndex = 0;
        }

        // 高亮函数名
        const functions = ['sin', 'cos', 'tan', 'log', 'sqrt', 'abs', 'max', 'min', 'pow'];
        for (const func of functions) {
          const funcRegex = new RegExp(`\\b${func}\\b`, 'g');
          while ((match = funcRegex.exec(line)) !== null) {
            const startPos = pos + match.index;
            const endPos = startPos + func.length;
            lineDecorations.push({
              from: startPos,
              to: endPos,
              decoration: Decoration.mark({ class: 'syntax-function' })
            });
          }
        }
      }

      // 按位置排序当前行的装饰器
      lineDecorations.sort((a, b) => {
        if (a.from !== b.from) {
          return a.from - b.from;
        }
        return a.to - b.to;
      });

      // 添加到总装饰器列表
      for (const item of lineDecorations) {
        decorations.push(item.decoration.range(item.from, item.to));
      }

      pos += line.length + 1; // +1 for newline
    }

    return decorations;
  }

  /**
   * 创建结果装饰器
   */
  function createResultDecorations(content: string, results: CalculationResult[]) {
    const widgets: any[] = [];
    let pos = 0;
    const lines = content.split('\n');

    /**
     * 测量文本的实际渲染宽度
     * 通过复制 CodeMirror 的实际样式来获得准确的宽度
     */
    function measureTextWidth(text: string, _lineStartPos: number): number {
      if (!view.value) return text.length * 8.4; // 降级方案

      // 获取 CodeMirror 的实际 DOM 样式
      const cmDom = view.value.dom;
      const cmStyle = window.getComputedStyle(cmDom);

      // 创建临时 span 测量宽度，完全复制 CodeMirror 的样式
      const span = document.createElement('span');
      span.style.visibility = 'hidden';
      span.style.position = 'absolute';
      span.style.whiteSpace = 'pre';
      span.style.fontFamily = cmStyle.fontFamily;
      span.style.fontSize = cmStyle.fontSize;
      span.style.fontWeight = cmStyle.fontWeight;
      span.style.fontStyle = cmStyle.fontStyle;
      span.style.letterSpacing = cmStyle.letterSpacing;
      span.textContent = text;

      // 将 span 添加到 CodeMirror 的 DOM 中以确保继承相同的上下文
      cmDom.appendChild(span);

      const width = span.getBoundingClientRect().width;
      cmDom.removeChild(span);

      return width;
    }

    /**
     * 计算行的内容长度（用于对齐）
     * 直接测量整行文本的宽度
     */
    function calculateContentLength(line: string, lineStartPos: number): number {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed === '') return 0;

      // 直接测量整行的宽度
      // 计算结果是通过 widget 添加的，不是文本的一部分
      return measureTextWidth(line, lineStartPos);
    }

    /**
     * 固定列对齐算法（类似表格列或 IDE 代码对齐）
     * 使用预定义的对齐位置，简单可靠
     */
    function calculateAlignMargins(lines: string[]): number[] {
      const BASE_MARGIN = 16;
      const WIDTH_THRESHOLD = 7 * 8.4; // 7个字的宽度阈值

      // 第一步：只看相邻行进行分组
      const groups: number[][] = [];
      let currentGroup: number[] = [];
      let lastLineWidth = 0; // 上一行的宽度
      let pos = 0; // 当前行的起始位置

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineStartPos = pos; // 保存当前行的起始位置
        pos += (line?.length ?? 0) + 1; // 更新到下一行的起始位置

        if (!line) {
          // 空行结束当前组
          if (currentGroup.length > 0) {
            groups.push([...currentGroup]);
            currentGroup = [];
            lastLineWidth = 0;
          }
          continue;
        }

        const result = results[i];
        const hasResult = result?.result !== undefined || result?.type === 'error';

        if (!hasResult) {
          // 没有结果的行结束当前组
          if (currentGroup.length > 0) {
            groups.push([...currentGroup]);
            currentGroup = [];
            lastLineWidth = 0;
          }
          continue;
        }

        // 当前行有结果
        const currWidth = calculateContentLength(line, lineStartPos);

        if (currentGroup.length === 0) {
          // 第一个有结果的行，开始新组
          currentGroup.push(i);
          lastLineWidth = currWidth;
        } else {
          // 只看相邻行：比较当前行和上一行的宽度差
          const widthDiff = Math.abs(currWidth - lastLineWidth);

          if (widthDiff <= WIDTH_THRESHOLD) {
            // 宽度差不超过阈值，加入当前组
            currentGroup.push(i);
            lastLineWidth = currWidth;
          } else {
            // 宽度差太大，结束当前组，开始新组
            groups.push([...currentGroup]);
            currentGroup = [i];
            lastLineWidth = currWidth;
          }
        }
      }

      // 添加最后一组
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }

      // 调试：输出分组信息
      console.log('[对齐算法] 分组结果:');
      groups.forEach((group, index) => {
        const groupLines = group.map(i => {
          const line = lines[i];
          return line ? `${i}:${line.trim().substring(0, 20)}` : `${i}:(空)`;
        });
        console.log(`  组${index + 1} [${group.length}行]:`, groupLines.join(', '));
      });

      // 第二步：为每组计算对齐边距
      const margins: number[] = new Array(lines.length).fill(BASE_MARGIN);

      // 计算所有行的起始位置
      const linePositions: number[] = [];
      let currentPos = 0;
      for (const line of lines) {
        linePositions.push(currentPos);
        currentPos += line.length + 1;
      }

      for (const group of groups) {
        // 找到组内最长的行
        let maxContentLength = 0;
        const groupWidths: { index: number; width: number; text: string }[] = [];

        for (const lineIndex of group) {
          const line = lines[lineIndex];
          if (!line) continue;
          const lineStartPos = linePositions[lineIndex] ?? 0;
          const contentLength = calculateContentLength(line, lineStartPos);
          groupWidths.push({ index: lineIndex, width: contentLength, text: line.trim().substring(0, 20) });
          maxContentLength = Math.max(maxContentLength, contentLength);
        }

        console.log(`[对齐算法] 组详情: 最大宽度=${maxContentLength.toFixed(1)}px`);
        console.table(groupWidths);

        // 所有结果对齐到最长行的最右侧
        const alignPosition = maxContentLength;

        // 计算每行的边距
        for (const lineIndex of group) {
          const line = lines[lineIndex];
          if (!line) continue;
          const lineStartPos = linePositions[lineIndex] ?? 0;
          const contentLength = calculateContentLength(line, lineStartPos);
          // marginLeft = 最长行宽度 - 当前行宽度
          const margin = alignPosition - contentLength + BASE_MARGIN;
          margins[lineIndex] = Math.max(margin, BASE_MARGIN);
          console.log(`[对齐算法]   行${lineIndex}: 宽度=${contentLength.toFixed(1)}px, margin=${margin.toFixed(1)}px`);
        }
      }

      return margins;
    }

    // 计算所有行的对齐边距，并收集调试信息
    const alignMargins = calculateAlignMargins(lines);

    for (let i = 0; i < Math.min(results.length, lines.length); i++) {
      const result = results[i];
      if (!result) continue;

      const line = lines[i];
      if (line === undefined) continue;

      // 移动到行尾
      pos += line.length;

      // 如果有结果，在行尾添加 widget
      if (
        result.result !== undefined ||
        result.type === 'error'
      ) {
        // 创建 widget 装饰器，传入计算好的边距
        const marginLeft = alignMargins[i] ?? 16;
        const widget = Decoration.widget({
          widget: new ResultWidget(result, marginLeft),
          side: 1,
        });
        // 使用 range 方法创建范围
        widgets.push(widget.range(pos));
      }

      // 移动到下一行开头
      pos += 1;
    }

    return widgets;
  }

  /**
   * 计算内容并更新装饰器
   */
  async function calculateContent() {
    const startTime = performance.now();

    if (!view.value) return;

    const content = view.value.state.doc.toString();
    const results = await calculator.calculateAll(content);

    // 更新当前结果，触发装饰器重新计算
    currentResults = results;

    // 触发视图更新以重新渲染装饰器
    if (view.value) {
      view.value.dispatch({
        effects: [],
      });
    }

    lastCalculationTime.value = new Date();
    previousContent.value = content;

    const endTime = performance.now();
    console.log(`计算耗时: ${endTime - startTime}ms`);
  }

  /** 防抖计算 */
  const debouncedCalculate = useThrottleFn(
    () => {
      if (props.config.isAutoCalculate) {
        calculateContent();
      }
    },
    30,
    true,
  );

  /**
   * 初始化编辑器
   */
  function initEditor() {
    if (!editorRef.value) return;

    // 创建编辑器状态
    const state = EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        dropCursor(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        // 暗色主题支持 - 暂时禁用
        // compartment.of(
        //   document.documentElement.classList.contains('dark') ? oneDark : [],
        // ),
        // 监听文档变化
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            emit('update:modelValue', newContent);
            debouncedCalculate();
          }
        }),
        // 装饰器扩展（计算结果和语法高亮）
        decorationsExtension,
      ],
    });

    // 创建编辑器视图
    view.value = new EditorView({
      state,
      parent: editorRef.value,
    });

    // 初始计算
    calculateContent();
  }

  /**
   * 更新编辑器内容
   */
  function updateEditorContent(newContent: string) {
    if (!view.value) return;

    const currentContent = view.value.state.doc.toString();
    if (currentContent === newContent) return;

    const transaction = view.value.state.update({
      changes: {
        from: 0,
        to: currentContent.length,
        insert: newContent,
      },
    });

    view.value.dispatch(transaction);
  }

  /**
   * 切换自动计算
   */
  function toggleAutoCalculate(): void {
    const newConfig = { ...props.config, isAutoCalculate: !props.config.isAutoCalculate };
    emit('update:config', newConfig);
  }

  /**
   * 监听内容变化
   */
  watch(
    () => props.modelValue,
    (newContent) => {
      if (view.value) {
        const currentContent = view.value.state.doc.toString();
        if (currentContent !== newContent) {
          updateEditorContent(newContent);
        }
      }
    },
  );

  /** 监听配置变化 */
  watch(
    () => props.config,
    (newConfig) => {
      calculator.updateConfig({
        precision: newConfig.precision,
        showPrecision: newConfig.showPrecision,
      });
      calculateContent();
    },
    { deep: true },
  );

  /** 监听暗色模式变化 - 暂时禁用 */
  // const updateTheme = () => {
  //   if (!view.value) return;
  //   // TODO: 重新启用暗色主题支持
  // };

  // 初始化编辑器
  onMounted(() => {
    initEditor();

    // 暂时禁用暗色模式监听
    // const observer = new MutationObserver(() => {
    //   updateTheme();
    // });

    // observer.observe(document.documentElement, {
    //   attributes: true,
    //   attributeFilter: ['class'],
    // });

    // onBeforeUnmount(() => {
    //   observer.disconnect();
    // });
  });
</script>

<style scoped>
  .codemirror-editor {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .dark .codemirror-editor {
    background-color: #1f2937;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
    background-color: #f9fafb;
  }

  .dark .editor-toolbar {
    border-bottom-color: #374151;
    background-color: #111827;
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background-color: #ffffff;
    color: #374151;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .dark .toolbar-button {
    border-color: #4b5563;
    background-color: #1f2937;
    color: #e5e7eb;
  }

  .toolbar-button:hover {
    background-color: #f3f4f6;
    border-color: #d1d5db;
  }

  .dark .toolbar-button:hover {
    background-color: #374151;
    border-color: #6b7280;
  }

  .toolbar-button.active {
    background-color: #dbeafe;
    border-color: #3b82f6;
    color: #1e40af;
  }

  .dark .toolbar-button.active {
    background-color: #1e3a8a;
    border-color: #3b82f6;
    color: #93c5fd;
  }

  .calculation-status,
  .calculation-time {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #6b7280;
  }

  /* 缩小加载动画，避免高度跳变 */
  .compact-spinner {
    width: 14px;
    height: 14px;
  }

  .dark .calculation-status,
  .dark .calculation-time {
    color: #9ca3af;
  }

  .editor-container {
    flex: 1;
    overflow: auto;
  }

  /* CodeMirror 样式覆盖 */
  :deep(.cm-editor) {
    height: 100%;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 14px;
  }

  :deep(.cm-scroller) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 14px;
  }

  :deep(.cm-content) {
    padding: 16px;
    max-width: none;
  }

  :deep(.cm-line) {
    padding: 0;
  }

  /* 结果 Widget 样式 */
  :deep(.cm-widget) {
    display: inline-flex;
    align-items: center;
    margin-left: 16px;
  }

  :deep(.result-widget) {
    padding: 2px 8px;
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }

  :deep(.result-widget--success) {
    background-color: #dcfce7;
    color: #166534;
    border-left: 2px solid #22c55e;
  }

  .dark :deep(.result-widget--success) {
    background-color: #14532d;
    color: #86efac;
    border-left-color: #22c55e;
  }

  :deep(.result-widget--error) {
    background-color: #fee2e2;
    color: #991b1b;
    border-left: 2px solid #ef4444;
  }

  .dark :deep(.result-widget--error) {
    background-color: #7f1d1d;
    color: #fca5a5;
    border-left-color: #ef4444;
  }

  :deep(.result-widget--warning) {
    background-color: #fef3c7;
    color: #92400e;
    border-left: 2px solid #f59e0b;
  }

  .dark :deep(.result-widget--warning) {
    background-color: #78350f;
    color: #fcd34d;
    border-left-color: #f59e0b;
  }

  :deep(.result-widget--normal) {
    background-color: #f3f4f6;
    color: #374151;
  }

  .dark :deep(.result-widget--normal) {
    background-color: #374151;
    color: #e5e7eb;
  }

  :deep(.formatted-number) {
    margin-left: 4px;
    opacity: 0.8;
    font-size: 0.9em;
  }

  /* 移动端适配 */
  @media (max-width: 768px) {
    .codemirror-editor {
      height: 100vh;
    }

    .editor-toolbar {
      padding: 8px 12px;
    }

    .toolbar-button span {
      display: none;
    }

    :deep(.cm-content) {
      padding: 12px;
    }
  }

  /* 语法高亮样式 */
  :deep(.syntax-h1-hash) {
    color: #3b82f6;
    font-weight: 700;
  }

  :deep(.syntax-h1-text) {
    color: #1e40af;
    font-weight: 700;
    font-size: 1.25em;
  }

  .dark :deep(.syntax-h1-text) {
    color: #93c5fd;
  }

  :deep(.syntax-h2-hash) {
    color: #6366f1;
    font-weight: 600;
  }

  :deep(.syntax-h2-text) {
    color: #4338ca;
    font-weight: 600;
    font-size: 1.1em;
  }

  .dark :deep(.syntax-h2-text) {
    color: #a5b4fc;
  }

  :deep(.syntax-number) {
    color: #059669;
    font-weight: 500;
  }

  .dark :deep(.syntax-number) {
    color: #34d399;
  }

  :deep(.syntax-variable) {
    color: #d97706;
    font-weight: 500;
  }

  .dark :deep(.syntax-variable) {
    color: #fbbf24;
  }

  :deep(.syntax-function) {
    color: #7c3aed;
    font-weight: 500;
  }

  .dark :deep(.syntax-function) {
    color: #a78bfa;
  }
</style>
