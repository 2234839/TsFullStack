<script setup lang="ts">
/**
 * 复选框组件
 * 基于 reka-ui CheckboxRoot/CheckboxIndicator primitives，无头行为 + Tailwind 样式
 *
 * @example
 * ```vue
 * <Checkbox v-model="checked">复选框文字</Checkbox>
 * ```
 */
import { CheckboxRoot, CheckboxIndicator } from "reka-ui";

defineOptions({ inheritAttrs: false });

interface Props {
  /** 模型值 */
  modelValue?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 复选框值（保留兼容字段） */
  value?: string | number | boolean;
}

withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();
</script>

<template>
  <CheckboxRoot
    v-bind="$attrs"
    :model-value="modelValue"
    :disabled="disabled"
    class="flex items-center gap-2"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <span
      class="h-5 w-5 shrink-0 rounded border transition-all duration-200"
      :class="
        modelValue
          ? 'border-primary-600 bg-primary-600 dark:border-primary-500 dark:bg-primary-500'
          : 'border-primary-default bg-white hover:border-primary-300 dark:bg-primary-900 dark:hover:border-primary-600'
      "
    >
      <CheckboxIndicator>
        <i class="pi pi-check text-sm text-white"></i>
      </CheckboxIndicator>
    </span>
    <slot />
  </CheckboxRoot>
</template>
