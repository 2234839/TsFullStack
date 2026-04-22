<script setup lang="ts">
/**
 * 选择按钮组组件
 * 使用 Tailwind CSS 样式
 * 支持水平滚动和边缘提示
 */
import { computed, watch, ref } from 'vue';
import { useElementBounding, useScroll } from '@vueuse/core';

/** 选项数据结构 */
interface SelectOption<T = string> {
  [key: string]: T;
}

interface Props<T = string> {
  /** 模型值 */
  modelValue?: T | T[];
  /** 选项列表 */
  options?: SelectOption<T> | T[];
  /** 选项显示文本的键名 */
  optionLabel?: string;
  /** 选项值的键名 */
  optionValue?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否多选 */
  multiple?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  multiple: false,
  options: () => [],
  optionLabel: 'label',
  optionValue: 'value',
});

const emit = defineEmits<{
  'update:modelValue': [value: unknown];
}>();

/** 滚动容器引用 */
const scrollContainer = ref<HTMLElement | null>(null);

/** 使用 VueUse 获取元素的边界信息 */
const { width: containerWidth } = useElementBounding(scrollContainer);

/** 使用 VueUse 获取滚动状态 */
const {
  arrivedState
} = useScroll(scrollContainer, {
  behavior: 'smooth'
});

/** 是否显示左侧提示 - 当没有到达左侧时显示 */
const showLeftHint = computed(() => !arrivedState.left);

/** 是否显示右侧提示 - 当没有到达右侧时显示 */
const showRightHint = computed(() => !arrivedState.right);

/** 滚动到左侧 */
function scrollToLeft() {
  scrollContainer.value?.scrollTo({
    left: 0,
    behavior: 'smooth',
  });
}

/** 滚动到右侧 */
function scrollToRight() {
  scrollContainer.value?.scrollBy({
    left: containerWidth.value,
    behavior: 'smooth',
  });
}

/** 处理选择 */
function handleSelect(value: unknown) {
  if (props.multiple) {
    const currentArray = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
    if (currentArray.some((v) => v === value)) {
      emit('update:modelValue', currentArray.filter((v) => v !== value));
    } else {
      emit('update:modelValue', [...currentArray, value]);
    }
  } else {
    emit('update:modelValue', value);
  }
}

/** 获取选项的显示值 */
function getOptionLabel(option: unknown): string {
  return typeof option === 'object' && option !== null
    ? String((option as Record<string, unknown>)[props.optionLabel] ?? '')
    : String(option ?? '');
}

/** 获取选项的值 */
function getOptionValue(option: unknown): unknown {
  return typeof option === 'object' && option !== null
    ? (option as Record<string, unknown>)[props.optionValue]
    : option;
}

/** 检查选项是否被选中 */
function isSelected(option: unknown): boolean {
  const value = getOptionValue(option);
  if (props.multiple) {
    return Array.isArray(props.modelValue) && props.modelValue.some((v) => v === value);
  }
  return props.modelValue === value;
}

/** 最后一个选项的索引 */
const lastIndex = computed(() => (props.options as unknown[]).length - 1);

/** 按钮样式类 */
const buttonClasses = (selected: boolean) => {
  return selected
    ? 'px-4 py-2 text-sm font-medium transition-colors duration-200 border bg-primary-600 text-white border-primary-600 dark:bg-primary-500 dark:border-primary-500 flex-shrink-0'
    : 'px-4 py-2 text-sm font-medium transition-colors duration-200 border bg-white text-primary-700 border-primary-200 hover:bg-primary-50 dark:bg-primary-900 dark:text-primary-300 dark:border-primary-700 dark:hover:bg-primary-700 flex-shrink-0';
};

const containerClasses = computed(() => {
  const base = 'inline-flex rounded-md overflow-hidden border';
  return props.disabled
    ? `${base} border-primary-100 dark:border-primary-800 opacity-50`
    : `${base} border-primary-200 dark:border-primary-700`;
});

const wrapperClasses = computed(() => {
  return 'relative flex items-center';
});


/** 监听选项变化，触发滚动状态重新计算 */
watch(
  () => props.options,
  () => {
    // VueUse 的 useScroll 会自动响应 DOM 变化
    // 这里只需要确保滚动容器存在
    if (scrollContainer.value) {
      // 触发一次重新计算
      const { scrollLeft } = scrollContainer.value;
      scrollContainer.value.scrollTo({ left: scrollLeft });
    }
  },
  { deep: true }
);
</script>

<template>
  <div :class="wrapperClasses">
    <!-- 左侧渐变遮罩和箭头 -->
    <Transition name="fade">
      <div v-if="showLeftHint"
        class="absolute left-0 top-0 bottom-0 z-10 flex items-center cursor-pointer pointer-events-auto"
        @click="scrollToLeft">
        <div
          class="h-full w-8 bg-linear-to-r from-white via-white/80 to-transparent dark:from-primary-900 dark:via-primary-900/80 flex items-center justify-start pl-1">
          <svg class="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      </div>
    </Transition>

    <!-- 滚动容器 -->
    <div ref="scrollContainer" :class="[containerClasses]" class="overflow-x-auto hide-scrollbar">
      <button v-for="(option, index) in options" :key="index" :disabled="disabled"
        :class="[buttonClasses(isSelected(option)), { 'border-r-0': Number(index) < lastIndex }]"
        @click="handleSelect(getOptionValue(option))">
        {{ getOptionLabel(option) }}
      </button>
    </div>

    <!-- 右侧渐变遮罩和箭头 -->
    <Transition name="fade">
      <div v-if="showRightHint"
        class="absolute right-0 top-0 bottom-0 z-10 flex items-center cursor-pointer pointer-events-auto"
        @click="scrollToRight">
        <div
          class="h-full w-8 bg-linear-to-l from-white via-white/80 to-transparent dark:from-primary-900 dark:via-primary-900/80 flex items-center justify-end pr-1">
          <svg class="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
