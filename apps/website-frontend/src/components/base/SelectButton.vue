<script setup lang="ts">
/**
 * 选择按钮组组件（基于 reka-ui ToggleGroup 无头 primitives）
 * 支持水平滚动和边缘提示，保留原 props/emits API
 */
import { computed, ref } from "vue";
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import { useElementBounding, useScroll } from "@vueuse/core";

defineOptions({ inheritAttrs: false });

/** 选项数据结构 */
interface SelectOption<T = string> {
  label: string;
  value: T;
}

interface Props<T = string> {
  /** 模型值 */
  modelValue?: T | T[];
  /** 选项列表 */
  options?: SelectOption<T>[] | T[];
  /** 选项显示文本的键名 */
  optionLabel?: string;
  /** 选项值的键名 */
  optionValue?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否多选 */
  multiple?: boolean;
}

const {
  modelValue,
  disabled = false,
  multiple = false,
  options = [] as unknown[],
  optionLabel = "label",
  optionValue = "value",
} = defineProps<Props>();

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
}>();

/** 滚动容器引用 */
const scrollContainer = ref<HTMLElement | null>(null);

/** 使用 VueUse 获取元素的边界信息 */
const { width: containerWidth } = useElementBounding(scrollContainer);

/** 使用 VueUse 获取滚动状态 */
const { arrivedState } = useScroll(scrollContainer, {
  behavior: "smooth",
});

/** 是否显示左侧提示 - 当没有到达左侧时显示 */
const showLeftHint = computed(() => !arrivedState.left);

/** 是否显示右侧提示 - 当没有到达右侧时显示 */
const showRightHint = computed(() => !arrivedState.right);

/** 滚动到左侧 */
function scrollToLeft() {
  scrollContainer.value?.scrollTo({
    left: 0,
    behavior: "smooth",
  });
}

/** 向右滚动一屏 */
function scrollToRight() {
  scrollContainer.value?.scrollBy({
    left: containerWidth.value,
    behavior: "smooth",
  });
}

/** 获取选项的显示值 */
function getOptionLabel(option: unknown): string {
  return typeof option === "object" && option !== null
    ? String((option as Record<string, unknown>)[optionLabel] ?? "")
    : String(option ?? "");
}

/** 获取选项的值 */
function getOptionValue(option: unknown): unknown {
  return typeof option === "object" && option !== null
    ? (option as Record<string, unknown>)[optionValue]
    : option;
}

/** ToggleGroup 的受控值（单选为值本身，多选为数组） */
const groupValue = computed(() => {
  if (multiple) return Array.isArray(modelValue) ? modelValue : [];
  return modelValue;
});

/** ToggleGroup 值变化 → 转换回原 API 的 emit */
function handleUpdate(value: unknown) {
  if (multiple) {
    emit("update:modelValue", Array.isArray(value) ? value : []);
  } else {
    // 单选模式下 ToggleGroup 点击已选中项会返回空数组/undefined，此时保持原值
    if (Array.isArray(value) || value === undefined) return;
    emit("update:modelValue", value);
  }
}

/** 最后一个选项的索引 */
const lastIndex = computed(() => (options as unknown[]).length - 1);

/** 选项按钮公共样式类（选中态由 reka 的 data-state 驱动） */
const buttonClasses =
  "px-4 py-2 text-sm font-medium transition-colors duration-200 border shrink-0 data-[state=on]:bg-primary-600 data-[state=on]:text-white data-[state=on]:border-primary-600 dark:data-[state=on]:bg-primary-500 dark:data-[state=on]:border-primary-500 data-[state=off]:bg-white data-[state=off]:text-primary-700 data-[state=off]:border-primary-200 hover:data-[state=off]:bg-primary-card dark:data-[state=off]:text-primary-300 dark:data-[state=off]:border-primary-700 dark:hover:data-[state=off]:bg-primary-700";

/** 容器样式类 */
const containerClasses = computed(() => {
  const base = "inline-flex rounded-md overflow-hidden border";
  return disabled
    ? `${base} border-primary-100 dark:border-primary-800 opacity-50`
    : `${base} border-primary-default`;
});
</script>

<template>
  <div v-bind="$attrs" class="relative flex items-center">
    <!-- 左侧渐变遮罩和箭头 -->
    <Transition name="fade">
      <div
        v-if="showLeftHint"
        class="absolute left-0 top-0 bottom-0 z-10 flex items-center cursor-pointer pointer-events-auto"
        @click="scrollToLeft"
      >
        <div
          class="h-full w-8 bg-linear-to-r from-white via-white/80 to-transparent dark:from-primary-900 dark:via-primary-900/80 flex items-center justify-start pl-1"
        >
          <svg
            class="w-4 h-4 text-primary-theme"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </div>
      </div>
    </Transition>

    <!-- 滚动容器（内嵌 ToggleGroup 无头组件） -->
    <div ref="scrollContainer" class="overflow-x-auto hide-scrollbar">
      <ToggleGroupRoot
        :type="multiple ? 'multiple' : 'single'"
        :model-value="groupValue"
        :disabled="disabled"
        :class="containerClasses"
        class="w-max"
        @update:model-value="handleUpdate"
      >
        <ToggleGroupItem
          v-for="(option, index) in options"
          :key="String(getOptionValue(option))"
          :value="(getOptionValue(option) ?? '') as string"
          :disabled="disabled"
          :class="[buttonClasses, { 'border-r-0': Number(index) < Number(lastIndex) }]"
        >
          {{ getOptionLabel(option) }}
        </ToggleGroupItem>
      </ToggleGroupRoot>
    </div>

    <!-- 右侧渐变遮罩和箭头 -->
    <Transition name="fade">
      <div
        v-if="showRightHint"
        class="absolute right-0 top-0 bottom-0 z-10 flex items-center cursor-pointer pointer-events-auto"
        @click="scrollToRight"
      >
        <div
          class="h-full w-8 bg-linear-to-l from-white via-white/80 to-transparent dark:from-primary-900 dark:via-primary-900/80 flex items-center justify-end pr-1"
        >
          <svg
            class="w-4 h-4 text-primary-theme"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
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
</style>
