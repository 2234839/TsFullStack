<script setup lang="ts">
/**
 * 多选组件（基于 reka-ui Combobox 无头 primitives，multiple 模式）
 * 浮层定位/键盘导航/焦点管理交给 reka，保留原 props/emits API
 */
import { computed } from "vue";
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxRoot,
  ComboboxTrigger,
} from "reka-ui";
import { useI18n } from "@/composables/useI18n";
import { INPUT_BASE_CLASSES } from "./inputStyles";

defineOptions({ inheritAttrs: false });

const { t } = useI18n();

/** 将可能为数组/单值/null/undefined的值规范化为数组 */
function normalizeToArray<T>(value: T[] | T | null | undefined): T[] {
  return Array.isArray(value) ? value : value != null ? [value] : [];
}

interface Option<T extends PropertyKey = PropertyKey> {
  label: string;
  value: T;
  disabled?: boolean;
}

interface Props<T extends PropertyKey = PropertyKey> {
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

const {
  modelValue,
  disabled = false,
  invalid = false,
  options = [] as Option[],
  placeholder,
  maxSelectedLabels = 3,
  selectedItemsLabel = "{0} items selected",
} = defineProps<Props>();

const emit = defineEmits<{
  "update:modelValue": [value: unknown[]];
}>();

/** Combobox 的受控值（规范化为数组） */
const selectedValues = computed(() => normalizeToArray(modelValue));

/** 选中值的字符串形式（reka 值为字符串化 key，避免对象/符号比较问题） */
const selectedKeys = computed(() => selectedValues.value.map((v) => String(v)));

/** 字符串 key → 原始值映射 */
const valueByKey = computed(() => {
  const map = new Map<string, unknown>();
  for (const opt of options ?? []) {
    map.set(String(opt.value), opt.value);
  }
  return map;
});

/** 处理 reka 多选值变化 → 转换回原始值数组 */
function handleUpdate(keys: unknown) {
  const keyArray = Array.isArray(keys) ? keys : keys != null ? [keys] : [];
  const rawValues = keyArray
    .map((k) => valueByKey.value.get(String(k)))
    .filter((v): v is unknown => v !== undefined);
  emit("update:modelValue", rawValues);
}

/** 获取选中的选项标签 */
const selectedLabels = computed(() => {
  const keys = new Set(selectedKeys.value);
  return (options ?? []).filter((opt) => keys.has(String(opt.value))).map((opt) => opt.label);
});

/** 显示的标签文本 */
const displayLabel = computed(() => {
  const labels = selectedLabels.value;
  if (labels.length === 0) return placeholder;
  if (labels.length <= maxSelectedLabels) {
    return labels.join(", ");
  }
  return selectedItemsLabel.replace("{0}", String(labels.length));
});

/** 触发按钮样式类 */
const triggerClasses = computed(() => {
  const extraClasses =
    "bg-white dark:bg-primary-900 min-h-[42px] flex items-center justify-between cursor-pointer w-full text-left";

  const stateClasses = invalid
    ? "border-danger-500 focus:ring-danger-500 dark:border-danger-400"
    : "border-primary-default focus:ring-primary-500 dark:focus:ring-primary-400";

  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

  return `${INPUT_BASE_CLASSES} ${extraClasses} ${stateClasses} ${disabledClass}`;
});
</script>

<template>
  <ComboboxRoot
    v-bind="$attrs"
    multiple
    :model-value="selectedKeys"
    :disabled="disabled"
    class="relative w-full"
    @update:model-value="handleUpdate"
  >
    <ComboboxAnchor class="w-full" as-child>
      <ComboboxTrigger :class="triggerClasses">
        <span class="flex-1 truncate text-primary-title">
          {{ displayLabel }}
        </span>
        <span class="ml-2 text-primary-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </span>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxContent
      position="popper"
      :side-offset="4"
      class="z-50 w-[var(--reka-combobox-trigger-width)] bg-white dark:bg-primary-900 border border-primary-default rounded-lg shadow-lg max-h-60 overflow-y-auto"
    >
      <ComboboxEmpty class="px-3 py-2 text-sm text-primary-subtle text-center">
        {{ t("没有可用选项") }}
      </ComboboxEmpty>
      <ComboboxItem
        v-for="option in options"
        :key="String(option.value)"
        :value="String(option.value)"
        :disabled="option.disabled"
        class="flex items-center px-3 py-2 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-700 transition-colors data-[highlighted]:bg-primary-100 dark:data-[highlighted]:bg-primary-700 outline-none"
      >
        <div class="flex items-center flex-1">
          <!-- 复选框指示 -->
          <div
            class="w-4 h-4 border rounded mr-3 flex items-center justify-center shrink-0 data-[state=checked]:bg-primary-500 dark:data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-500 dark:data-[state=checked]:border-primary-600 border-primary-default"
          >
            <ComboboxItemIndicator>
              <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="3"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </ComboboxItemIndicator>
          </div>
          <!-- 标签 -->
          <span class="text-sm text-primary-700 dark:text-primary-200">{{ option.label }}</span>
        </div>
      </ComboboxItem>
    </ComboboxContent>
  </ComboboxRoot>
</template>
