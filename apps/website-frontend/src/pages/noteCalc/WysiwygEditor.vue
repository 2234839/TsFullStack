<template>
  <div
    class="wysiwyg-editor"
    :class="editorClasses"
    @scroll="handleScroll">
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
          <ProgressSpinner size="small" />
          <span>计算中...</span>
        </div>

        <div v-else-if="lastCalculationTime" class="calculation-time">
          <span>上次计算: {{ lastCalculationTime_v }}</span>
        </div>
      </div>
    </div>

    <!-- 编辑区域 -->
    <div class="editor-content">
      <!-- 行容器 -->
      <div class="lines-container">
        <!-- 空状态提示 -->
        <div v-if="lines.length === 0" class="empty-state">
          <i class="pi pi-file-edit" />
          <p>开始输入表达式...</p>
          <p class="empty-hint">
            例如: <code>2 + 2</code> 或 <code>价格 = 99.5</code>
          </p>
        </div>

        <!-- 行列表 -->
        <EditableLine
          v-for="(line, index) in lines"
          :key="`line-${index}`"
          :ref="el => setLineRef(el, index)"
          :content="line"
          :result="results[index] || defaultResult"
          :line-index="index"
          :is-focused="focusedLine === index"
          :show-result="showResults"
          @update:content="handleLineUpdate(index, $event)"
          @focus="focusedLine = index"
          @blur="handleLineBlur(index)"
          @keydown="handleLineKeydown(index, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, ref, watch } from 'vue';
  import { useThrottleFn } from '@vueuse/core';
  import EditableLine from './EditableLine.vue';
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
  const focusedLine = ref<number>(-1);
  const showResults = ref(true);
  const lastCalculationTime = ref<Date | null>(null);
  const previousContent = ref('');
  const lineRefs = ref<Map<number, InstanceType<typeof EditableLine>>>(new Map());

  /** 默认结果 */
  const defaultResult: CalculationResult = {
    type: 'normal',
    content: '',
  };

  /** 计算器实例 */
  const calculator = useCalculator({
    precision: props.config.precision,
    showPrecision: props.config.showPrecision,
  });

  /** 行数据 */
  const lines = computed(() => props.modelValue.split('\n'));

  /** 计算结果 */
  const results = ref<CalculationResult[]>([]);

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
      'wysiwyg-editor--has-content': lines.value.length > 0,
    };
  });

  /** 设置行引用 */
  function setLineRef(el: any, index: number) {
    if (el) {
      lineRefs.value.set(index, el);
    } else {
      lineRefs.value.delete(index);
    }
  }

  /** 获取指定行的引用 */
  function getLineRef(index: number): InstanceType<typeof EditableLine> | undefined {
    return lineRefs.value.get(index);
  }

  /** 计算内容 */
  async function calculateContent(forceFullCalculation = false): Promise<void> {
    const startTime = performance.now();

    let newResults: CalculationResult[];

    if (forceFullCalculation || previousContent.value === '') {
      newResults = await calculator.calculateAll(props.modelValue);
    } else {
      newResults = await calculator.calculateIncremental(previousContent.value, props.modelValue);
    }

    results.value = newResults;
    lastCalculationTime.value = new Date();
    previousContent.value = props.modelValue;

    const endTime = performance.now();
    console.log(`计算耗时: ${endTime - startTime}ms`);
  }

  /** 防抖计算 - 更快的响应 */
  const debouncedCalculate = useThrottleFn(
    () => {
      if (props.config.isAutoCalculate) {
        calculateContent();
      }
    },
    30, // 从 50ms 优化到 30ms
    true,
  );

  /** 处理行更新 */
  function handleLineUpdate(lineIndex: number, newContent: string): void {
    const newLines = [...lines.value];
    newLines[lineIndex] = newContent;
    const newContentValue = newLines.join('\n');

    emit('update:modelValue', newContentValue);
    debouncedCalculate();
  }

  /** 处理行失焦 */
  function handleLineBlur(lineIndex: number): void {
    if (focusedLine.value === lineIndex) {
      focusedLine.value = -1;
    }
  }

  /** 处理键盘事件 */
  function handleLineKeydown(lineIndex: number, event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      // 在当前行后插入新行
      const newLines = [...lines.value];
      newLines.splice(lineIndex + 1, 0, '');
      emit('update:modelValue', newLines.join('\n'));

      // 聚焦到新行
      nextTick(() => {
        focusedLine.value = lineIndex + 1;
        const newLineRef = getLineRef(lineIndex + 1);
        newLineRef?.focus();
      });
    } else if (event.key === 'Backspace' && lines.value[lineIndex] === '') {
      event.preventDefault();

      // 删除当前行（至少保留一行）
      if (lines.value.length > 1) {
        const newLines = lines.value.filter((_, i) => i !== lineIndex);
        emit('update:modelValue', newLines.join('\n'));

        // 聚焦到上一行
        if (lineIndex > 0) {
          nextTick(() => {
            focusedLine.value = lineIndex - 1;
            const prevLineRef = getLineRef(lineIndex - 1);
            prevLineRef?.focus();
          });
        }
      }
    } else if (event.key === 'ArrowUp' && lineIndex > 0) {
      event.preventDefault();
      const prevLineRef = getLineRef(lineIndex - 1);
      prevLineRef?.focus();
    } else if (event.key === 'ArrowDown' && lineIndex < lines.value.length - 1) {
      event.preventDefault();
      const nextLineRef = getLineRef(lineIndex + 1);
      nextLineRef?.focus();
    }
  }

  /** 处理滚动 */
  function handleScroll(_event: Event): void {
    // 可选：实现虚拟滚动
  }

  /** 切换自动计算 */
  function toggleAutoCalculate(): void {
    const newConfig = { ...props.config, isAutoCalculate: !props.config.isAutoCalculate };
    emit('update:config', newConfig);
  }

  /** 监听内容变化 */
  watch(
    () => props.modelValue,
    () => {
      debouncedCalculate();
    },
    { deep: false },
  );

  /** 监听配置变化 */
  watch(
    () => props.config,
    newConfig => {
      calculator.updateConfig({
        precision: newConfig.precision,
        showPrecision: newConfig.showPrecision,
      });
      calculateContent(true);
    },
    { deep: true },
  );

  /** 初始化 */
  onMounted(() => {
    calculateContent(true);
  });
</script>

<style scoped>
  .wysiwyg-editor {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .dark .wysiwyg-editor {
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

  .dark .calculation-status,
  .dark .calculation-time {
    color: #9ca3af;
  }

  .editor-content {
    flex: 1;
    overflow-y: auto;
    position: relative;
  }

  .lines-container {
    padding: 16px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    color: #9ca3af;
  }

  .empty-state i {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 8px 0;
    font-size: 14px;
  }

  .empty-hint {
    font-size: 12px;
    color: #6b7280;
  }

  .empty-hint code {
    padding: 2px 6px;
    background-color: #f3f4f6;
    border-radius: 3px;
    font-family: ui-monospace, monospace;
  }

  .dark .empty-hint code {
    background-color: #374151;
  }

  /* 移动端适配 */
  @media (max-width: 768px) {
    .wysiwyg-editor {
      height: 100vh;
    }

    .editor-toolbar {
      padding: 8px 12px;
    }

    .toolbar-button span {
      display: none; /* 移动端隐藏按钮文字，只显示图标 */
    }

    .lines-container {
      padding: 12px;
    }
  }
</style>
