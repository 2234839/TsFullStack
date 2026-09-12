<script setup lang="ts">
/**
 * 滑块组件
 * 基于 reka-ui SliderRoot primitives，无头行为 + Tailwind 样式
 *
 * @example
 * ```vue
 * <Slider v-model="value" :min="0" :max="100" :step="1" />
 * ```
 */
import { computed } from "vue";
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from "reka-ui";

defineOptions({ inheritAttrs: false });

interface Props {
  /** 模型值 */
  modelValue?: number;
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 步长 */
  step?: number;
  /** 是否禁用 */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

/** 双向绑定的模型值（reka-ui Slider 使用数组模型） */
const model = computed({
  get: () => [props.modelValue],
  set: (val: number[]) => emit("update:modelValue", val[0] ?? props.min),
});
</script>

<template>
  <SliderRoot
    v-bind="$attrs"
    v-model="model"
    class="relative flex h-5 w-full touch-none select-none items-center"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
  >
    <SliderTrack class="bg-primary-200 dark:bg-primary-800 relative h-2 w-full grow rounded-full">
      <SliderRange class="bg-primary-700 dark:bg-primary-300 absolute h-full rounded-full" />
    </SliderTrack>
    <SliderThumb
      class="border-primary-700 dark:border-primary-300 bg-primary-surface block h-4 w-4 rounded-full border-2 shadow-md transition-transform duration-150 hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      :aria-label="`值 ${modelValue}`"
    />
  </SliderRoot>
</template>
