<script setup lang="ts">
/**
 * 多选组件
 * 使用 Tailwind CSS 样式
 */
import { computed, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

/** 将可能为数组/单值/null/undefined的值规范化为数组 */
function normalizeToArray<T>(value: T[] | T | null | undefined): T[] {
  return Array.isArray(value) ? value : value != null ? [value] : [];
}

interface Option<T = unknown> {
  label: string;
  value: T;
  disabled?: boolean;
}

interface Props<T = unknown> {
  /** 模型值 */
  modelValue?: T[] | T;
  /** 选项列表 */
  options?: readonly Option<T>[] | Option<T>[];
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 错误状态 */
  invalid?: boolean;
  /** 选项的最大显示数量 */
  maxSelectedLabels?: number;
  /** 选中的数量标签 */
  selectedItemsLabel?: string;
}

const { modelValue, disabled = false, invalid = false, options = [] as Option[], placeholder, maxSelectedLabels = 3, selectedItemsLabel = '{0} items selected' } = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: unknown[]];
}>();

/** 下拉框打开状态 */
const isOpen = ref(false);

/** 切换下拉框 */
function toggleDropdown() {
  if (!disabled) {
    isOpen.value = !isOpen.value;
  }
}

/** 处理选项点击 */
function handleOptionClick(option: Option) {
  if (option.disabled) return;

  const rawValue = modelValue;
  const currentValue = normalizeToArray(rawValue);
  const index = currentValue.indexOf(option.value);

  if (index === -1) {
    emit('update:modelValue', [...currentValue, option.value]);
  } else {
    currentValue.splice(index, 1);
    emit('update:modelValue', currentValue);
  }
}

/** 检查选项是否被选中 */
const isSelected = (option: Option) => {
  const rawValue = modelValue;
  const valueArray = Array.isArray(rawValue) ? rawValue : rawValue != null ? [rawValue] : [];
  return valueArray.some((v) => v === option.value);
};

/** 获取选中的选项标签 */
const selectedLabels = computed(() => {
  const rawValue = modelValue;
  const valueArray = Array.isArray(rawValue) ? rawValue : rawValue != null ? [rawValue] : [];
  const selected = (options || []).filter(opt =>
    valueArray.includes(opt.value)
  );
  return selected.map(opt => opt.label);
});

/** 显示的标签文本 */
const displayLabel = computed(() => {
  const labels = selectedLabels.value;
  if (labels.length === 0) return placeholder;
  if (labels.length <= maxSelectedLabels) {
    return labels.join(', ');
  }
  return selectedItemsLabel.replace('{0}', String(labels.length));
});

/** 触发按钮样式类 */
const triggerClasses = computed(() => {
  const base = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200 bg-white dark:bg-primary-900 min-h-[42px] flex items-center justify-between cursor-pointer';

  const stateClasses = invalid
    ? 'border-danger-500 focus:ring-danger-500 dark:border-danger-400'
    : 'border-primary-200 dark:border-primary-700 focus:ring-primary-500 dark:focus:ring-primary-400';

  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${base} ${stateClasses} ${disabledClass}`;
});

/** 下拉面板样式 */
</script>

<template>
  <div class="relative w-full">
    <!-- 触发按钮 -->
    <div
      :class="triggerClasses"
      @click="toggleDropdown">
      <span class="flex-1 truncate text-primary-900 dark:text-primary-100">
        {{ displayLabel }}
      </span>
      <span class="ml-2 text-primary-400">
        <svg
          class="w-4 h-4 transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>

    <!-- 下拉面板 -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95">
      <div
        v-if="isOpen"
        :class="'absolute z-50 w-full mt-1 bg-white dark:bg-primary-900 border border-primary-200 dark:border-primary-700 rounded-lg shadow-lg max-h-60 overflow-y-auto'">
        <div
          v-for="option in options"
          :key="option.value"
          class="flex items-center px-3 py-2 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-700 transition-colors"
          :class="{ 'opacity-50 cursor-not-allowed': option.disabled }"
          @click="handleOptionClick(option)">
          <div class="flex items-center flex-1">
            <!-- 复选框 -->
            <div class="w-4 h-4 border rounded mr-3 flex items-center justify-center shrink-0"
                 :class="isSelected(option)
                   ? 'bg-primary-500 border-primary-500'
                   : 'border-primary-200 dark:border-primary-700'">
              <svg v-if="isSelected(option)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <!-- 标签 -->
            <span class="text-sm text-primary-700 dark:text-primary-200">{{ option.label }}</span>
          </div>
        </div>
        <div
          v-if="options.length === 0"
          class="px-3 py-2 text-sm text-primary-500 dark:text-primary-400 text-center">
          {{ t('没有可用选项') }}
        </div>
      </div>
    </Transition>

    <!-- 点击外部关闭 -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-40"
        @click="isOpen = false">
      </div>
    </Teleport>
  </div>
</template>
