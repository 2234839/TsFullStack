<script setup lang="ts">
/**
 * 日期选择器组件
 * 基于 reka-ui DatePicker/Calendar primitives 的弹层式日期时间选择器
 */
import { computed } from "vue";
import {
  DatePickerRoot,
  DatePickerField,
  DatePickerInput,
  DatePickerTrigger,
  DatePickerContent,
  DatePickerCalendar,
  CalendarGrid,
  CalendarGridHead,
  CalendarGridRow,
  CalendarGridBody,
  CalendarHeadCell,
  CalendarCell,
  CalendarCellTrigger,
  CalendarHeader,
  CalendarHeading,
  CalendarPrev,
  CalendarNext,
} from "reka-ui";
import type { DateValue } from "reka-ui";
import { CalendarDate, CalendarDateTime } from "@internationalized/date";
import { toDate } from "reka-ui/date";
import { INPUT_BASE_CLASSES } from "./inputStyles";

interface Props {
  /** 模型值 */
  modelValue?: Date | string | null;
  /** 是否显示时间 */
  showTime?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  showTime: true,
  disabled: false,
});
defineOptions({ inheritAttrs: false });

const emit = defineEmits<{
  "update:modelValue": [value: Date | string | null];
  show: [];
  hide: [];
}>();

/** 外部值统一转为合法 native Date，非法返回 null */
function toNativeDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** native Date 转 reka-ui 的 DateValue（showTime 时带时分） */
function toDateValue(date: Date): DateValue {
  if (props.showTime) {
    return new CalendarDateTime(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    );
  }
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** 内部 DateValue 与外部 modelValue 的双向桥接 */
const dateValue = computed<DateValue | undefined>({
  get: () => {
    const date = toNativeDate(props.modelValue);
    return date ? toDateValue(date) : undefined;
  },
  set: (value) => {
    emit("update:modelValue", value ? toDate(value) : null);
  },
});

/** reka-ui 粒度：showTime 时精确到分钟 */
const granularity = computed(() => (props.showTime ? "minute" : "day"));

/** 弹层开关变化时转发 show/hide */
function handleOpenChange(open: boolean) {
  if (open) emit("show");
  else emit("hide");
}

/** 是否有有效值（决定清除按钮显隐） */
const hasValue = computed(() => toNativeDate(props.modelValue) !== null);

/** 清空值 */
function clearValue() {
  emit("update:modelValue", null);
}

/** 输入框容器样式类 */
const fieldClasses = computed(() => {
  const disabledClass = props.disabled ? "opacity-50 cursor-not-allowed" : "";
  return `${INPUT_BASE_CLASSES} bg-primary-surface border-primary-300 dark:border-primary-700 text-primary-title ${disabledClass}`;
});
</script>

<template>
  <DatePickerRoot
    v-model="dateValue"
    :granularity="granularity"
    locale="zh-CN"
    :disabled="disabled"
    :close-on-select="!showTime"
    @update:open="handleOpenChange"
  >
    <div class="relative inline-flex w-full">
      <DatePickerField v-bind="$attrs" :class="fieldClasses" class="flex items-center gap-0.5 pr-9">
        <template #default="{ segments }">
          <template v-for="item in segments" :key="item.part">
            <DatePickerInput
              v-if="item.part === 'literal'"
              :part="item.part"
              class="text-primary-400"
              >{{ item.value }}</DatePickerInput
            >
            <DatePickerInput
              v-else
              :part="item.part"
              class="rounded px-0.5 focus:bg-secondary-100 focus:outline-none dark:focus:bg-secondary-900 data-[placeholder]:text-primary-400"
              >{{ item.value }}</DatePickerInput
            >
          </template>
        </template>
      </DatePickerField>
      <button
        v-if="hasValue && !disabled"
        type="button"
        aria-label="清除日期"
        class="text-primary-400 hover:text-danger-500 absolute inset-y-0 right-8 flex items-center px-1"
        @click.stop="clearValue"
      >
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
        </svg>
      </button>
      <DatePickerTrigger
        class="text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 absolute inset-y-0 right-0 flex items-center px-2 focus:outline-none disabled:cursor-not-allowed"
      >
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round" />
        </svg>
      </DatePickerTrigger>
    </div>
    <DatePickerContent
      :side-offset="4"
      class="bg-primary-card border-primary-default text-primary-body z-50 w-72 rounded-lg border p-3 shadow-lg"
    >
      <DatePickerCalendar v-slot="{ grid, weekDays }">
        <CalendarHeader class="mb-2 flex items-center justify-between">
          <CalendarPrev
            class="text-primary-body hover:bg-primary-surface inline-flex size-8 items-center justify-center rounded-md"
          >
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </CalendarPrev>
          <CalendarHeading class="text-primary-title text-sm font-semibold" />
          <CalendarNext
            class="text-primary-body hover:bg-primary-surface inline-flex size-8 items-center justify-center rounded-md"
          >
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </CalendarNext>
        </CalendarHeader>
        <div v-for="month in grid" :key="month.value.toString()">
          <CalendarGrid class="w-full border-collapse">
            <CalendarGridHead>
              <CalendarGridRow>
                <CalendarHeadCell
                  v-for="day in weekDays"
                  :key="day"
                  class="text-primary-label w-9 pb-1 text-xs font-medium"
                >
                  {{ day }}
                </CalendarHeadCell>
              </CalendarGridRow>
            </CalendarGridHead>
            <CalendarGridBody>
              <CalendarGridRow v-for="(weekDates, index) in month.rows" :key="index" class="mt-1">
                <CalendarCell
                  v-for="date in weekDates"
                  :key="date.toString()"
                  :date="date"
                  class="relative size-9 p-0 text-center text-sm"
                >
                  <CalendarCellTrigger
                    :day="date"
                    :month="month.value"
                    class="text-primary-body data-[selected]:bg-primary-600 data-[selected]:text-white hover:bg-primary-surface data-[today]:text-secondary-500 data-[outside-view]:text-primary-300 dark:data-[outside-view]:text-primary-700 data-[unavailable]:text-primary-300 data-[unavailable]:line-through relative flex size-9 items-center justify-center rounded-md data-[disabled]:opacity-50 data-[unavailable]:pointer-events-none"
                  />
                </CalendarCell>
              </CalendarGridRow>
            </CalendarGridBody>
          </CalendarGrid>
        </div>
      </DatePickerCalendar>
    </DatePickerContent>
  </DatePickerRoot>
</template>
