<script setup lang="ts">
/**
 * 切换开关组件
 * 基于 reka-ui SwitchRoot/SwitchThumb primitives，无头行为 + Tailwind 样式
 *
 * @example
 * ```vue
 * <ToggleSwitch v-model="on" />
 * ```
 */
import { SwitchRoot, SwitchThumb } from "reka-ui";

defineOptions({ inheritAttrs: false });

interface Props {
  /** 模型值 */
  modelValue?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
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
  <SwitchRoot
    v-bind="$attrs"
    :model-value="modelValue"
    :disabled="disabled"
    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-primary-900"
    :class="
      modelValue ? 'bg-primary-600 dark:bg-primary-500' : 'bg-primary-200 dark:bg-primary-700'
    "
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <SwitchThumb
      class="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-in-out"
      :class="modelValue ? 'translate-x-6' : 'translate-x-1'"
    />
  </SwitchRoot>
</template>
