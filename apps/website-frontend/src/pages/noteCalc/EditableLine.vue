<template>
  <div
    class="editable-line"
    :class="lineClasses"
    :data-line-index="lineIndex"
    :data-line-type="result.type">
    <!-- 行类型图标 -->
    <div v-if="showTypeIcon" class="line-type-icon">
      <i :class="getTypeIcon(result.type)" />
    </div>

    <!-- 输入框 -->
    <input
      ref="inputRef"
      v-model="localContent"
      type="text"
      class="line-input"
      :class="inputClasses"
      :placeholder="placeholder"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
      @compositionstart="handleCompositionStart"
      @compositionend="handleCompositionEnd"
    />

    <!-- 结果徽章 -->
    <transition name="result-fade">
      <div v-if="shouldShowResult" class="result-badge" :class="resultBadgeClasses">
        <span class="result-text">{{ formattedResult }}</span>
        <span v-if="result.isLargeNumber" class="formatted-number">
          {{ result.formattedNumber }}
        </span>
      </div>
    </transition>

    <!-- 错误提示 -->
    <transition name="error-slide">
      <div v-if="showError" class="error-tooltip">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ result.error }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import type { CalculationResult } from './types';
  import { useI18n } from '@/composables/useI18n';

  const { t } = useI18n();

  interface Props {
    /** 行内容 */
    content: string;
    /** 计算结果 */
    result: CalculationResult;
    /** 行索引 */
    lineIndex: number;
    /** 是否聚焦 */
    isFocused?: boolean;
    /** 是否显示结果 */
    showResult?: boolean;
  }

  const { content, result, lineIndex, isFocused = false, showResult = true } = defineProps<Props>()

  const emit = defineEmits<{
    'update:content': [content: string];
    focus: [];
    blur: [];
    keydown: [event: KeyboardEvent];
  }>();

  /** 本地内容状态 */
  const localContent = ref(content);
  const inputRef = ref<HTMLInputElement>();
  const isComposing = ref(false);

  /** 行样式类 */
  const lineClasses = computed(() => {
    return {
      'editable-line--focused': isFocused,
      'editable-line--error': result.type === 'error',
      'editable-line--title': result.type === 'title',
      'editable-line--subtitle': result.type === 'subtitle',
      'editable-line--comment': result.type === 'comment',
    };
  });

  /** 输入框样式类 */
  const inputClasses = computed(() => {
    const type = result.type;
    const classes: string[] = [`line-input--${type}`];

    // 根据行类型添加不同的样式
    if (type === 'title' || type === 'subtitle') {
      classes.push('line-input--heading');
    }
    if (type === 'comment') {
      classes.push('line-input--comment');
    }

    return classes.join(' ');
  });

  /** 结果徽章样式类 */
  const resultBadgeClasses = computed(() => {
    const type = result.type;

    if (type === 'error') {
      return 'result-badge--error';
    }

    if (type === 'equation' && result.isCorrect === false) {
      return 'result-badge--warning';
    }

    if (type === 'assignment' || type === 'expression' || type === 'unitConversion') {
      return 'result-badge--success';
    }

    return '';
  });

  /** 占位符 */
  const placeholder = computed(() => {
    switch (result.type) {
      case 'empty':
        return t('输入表达式或按 Enter 换行...');
      case 'title':
        return t('输入一级标题...');
      case 'subtitle':
        return t('输入二级标题...');
      case 'comment':
        return t('输入注释...');
      default:
        return t('输入表达式...');
    }
  });

  /** 是否显示类型图标 */
  const showTypeIcon = computed(() => {
    return ['title', 'subtitle', 'comment'].includes(result.type);
  });

  /** 是否应该显示结果 */
  const shouldShowResult = computed(() => {
    if (!showResult) return false;
    if (isComposing.value) return false;
    if (!hasResult.value) return false;
    return true;
  });

  /** 是否有结果 */
  const hasResult = computed(() => {
    return result.result !== undefined || result.type === 'error';
  });

  /** 是否显示错误 */
  const showError = computed(() => {
    return result.type === 'error' && isFocused;
  });

  /** 格式化结果 */
  const formattedResult = computed(() => {
    if (result.type === 'error') {
      return `${t('错误')}: ${result.error}`;
    }
    if (result.result) {
      return `= ${result.result}`;
    }
    return '';
  });

  /** 获取类型图标 */
  function getTypeIcon(type: string): string {
    switch (type) {
      case 'title':
        return 'pi pi-heading';
      case 'subtitle':
        return 'pi pi-heading';
      case 'comment':
        return 'pi pi-comment';
      default:
        return '';
    }
  }

  /** 处理聚焦 */
  function handleFocus() {
    emit('focus');
  }

  /** 处理失焦 */
  function handleBlur() {
    emit('blur');
  }

  /** 处理键盘事件 */
  function handleKeydown(event: KeyboardEvent) {
    emit('keydown', event);
  }

  /** 处理输入开始 */
  function handleCompositionStart() {
    isComposing.value = true;
  }

  /** 处理输入结束 */
  function handleCompositionEnd(event: CompositionEvent) {
    isComposing.value = false;
    const data = event.data || localContent.value;
    localContent.value = data;
    emit('update:content', data);
  }

  /** 同步外部内容变化 */
  watch(
    () => content,
    newContent => {
      if (newContent !== localContent.value) {
        localContent.value = newContent;
      }
    },
  );

  /** 同步本地内容变化 */
  watch(localContent, newContent => {
    if (!isComposing.value) {
      emit('update:content', newContent);
    }
  });

  /** 聚焦输入框 */
  function focus(): void {
    inputRef.value?.focus();
  }

  /** 暴露方法给父组件 */
  defineExpose({
    focus,
  });
</script>

<style scoped>
  .editable-line {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    transition: background-color 0.2s;
    flex-wrap: wrap;
  }

  .editable-line:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }

  .dark .editable-line:hover {
    background-color: rgba(255, 255, 255, 0.02);
  }

  .editable-line--focused {
    background-color: rgba(0, 0, 0, 0.04);
  }

  .dark .editable-line--focused {
    background-color: rgba(255, 255, 255, 0.04);
  }

  .line-type-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-gray-500, #6b7280);
  }

  .dark .line-type-icon {
    color: var(--color-gray-400, #9ca3af);
  }

  .line-input {
    min-width: 100px;
    max-width: 600px;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    background-color: transparent;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 14px;
    line-height: 1.5;
    color: inherit;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .line-input:focus {
    border-color: var(--color-blue-500, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .line-input--heading {
    font-weight: 700;
  }

  .line-input--title {
    font-size: 18px;
  }

  .line-input--subtitle {
    font-size: 16px;
  }

  .line-input--comment {
    color: var(--color-gray-500, #6b7280);
  }

  .dark .line-input--comment {
    color: var(--color-gray-400, #9ca3af);
  }

  .result-badge {
    flex-shrink: 0;
    padding: 4px 12px;
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .result-badge--success {
    background-color: var(--color-green-100, #dcfce7);
    color: var(--color-green-800, #166534);
    border-left: 3px solid var(--color-green-500, #22c55e);
  }

  .dark .result-badge--success {
    background-color: var(--color-green-900, #14532d);
    color: var(--color-green-200, #86efac);
    border-left-color: var(--color-green-500, #22c55e);
  }

  .result-badge--error {
    background-color: var(--color-red-100, #fee2e2);
    color: var(--color-red-800, #991b1b);
    border-left: 3px solid var(--color-red-500, #ef4444);
  }

  .dark .result-badge--error {
    background-color: var(--color-red-900, #7f1d1d);
    color: var(--color-red-200, #fca5a5);
    border-left-color: var(--color-red-500, #ef4444);
  }

  .result-badge--warning {
    background-color: var(--color-amber-100, #fef3c7);
    color: var(--color-amber-800, #92400e);
    border-left: 3px solid var(--color-amber-500, #f59e0b);
  }

  .dark .result-badge--warning {
    background-color: var(--color-amber-900, #78350f);
    color: var(--color-amber-200, #fcd34d);
    border-left-color: var(--color-amber-500, #f59e0b);
  }

  .result-text {
    margin-right: 4px;
  }

  .formatted-number {
    opacity: 0.8;
    font-size: 0.9em;
  }

  .error-tooltip {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    padding: 8px 12px;
    background-color: var(--color-red-100, #fee2e2);
    color: var(--color-red-800, #991b1b);
    border-radius: 4px;
    font-size: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dark .error-tooltip {
    background-color: var(--color-red-900, #7f1d1d);
    color: var(--color-red-200, #fca5a5);
  }

  /* 过渡动画 */
  .result-fade-enter-active,
  .result-fade-leave-active {
    transition: opacity 0.2s, transform 0.2s;
  }

  .result-fade-enter-from,
  .result-fade-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }

  .error-slide-enter-active,
  .error-slide-leave-active {
    transition: opacity 0.2s, transform 0.2s;
  }

  .error-slide-enter-from,
  .error-slide-leave-to {
    opacity: 0;
    transform: translateY(-8px);
  }

  /* 移动端适配 */
  @media (max-width: 768px) {
    .editable-line {
      /* 增加行高便于触摸 */
      min-height: 44px;
      padding: 12px;
    }

    .result-badge {
      /* 结果换行显示 */
      display: block;
      max-width: 100%;
      margin-top: 4px;
    }
  }
</style>
