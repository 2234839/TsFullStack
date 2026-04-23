<script setup lang="ts">
/**
 * 滑块组件
 * 使用 Tailwind CSS 样式
 */
import { computed, ref } from 'vue';
import { useEventListener } from '@vueuse/core';

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

const { modelValue, min = 0, max = 100, step = 1, disabled = false } = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

/** 内部状态 */
const isDragging = ref(false);
const sliderRef = ref<HTMLElement | null>(null);

/** 当前值的百分比 */
const percentage = computed(() => {
  const rangeVal = max - min;
  const val = Math.max(min, Math.min(max, modelValue ?? min));
  return ((val - min) / rangeVal) * 100;
});

/** 处理滑块拖动 */
function handleDrag(event: MouseEvent) {
  if (!sliderRef.value || disabled) return;

  const rect = sliderRef.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const width = rect.width;

  let rawPercentage = (x / width) * 100;
  rawPercentage = Math.max(0, Math.min(100, rawPercentage));

  const rangeVal = max - min;
  let val = min + (rawPercentage / 100) * rangeVal;

  // 对齐到步长
  val = Math.round(val / step) * step;
  val = Math.max(min, Math.min(max, val));

  emit('update:modelValue', val);
}

/** 处理滑块轨道点击 */
function handleClick(event: MouseEvent) {
  if (disabled) return;
  handleDrag(event);
}

/** 开始拖动 */
function startDrag(event: MouseEvent) {
  if (disabled) return;
  isDragging.value = true;
  event.preventDefault();

  const handleMouseMove = (e: MouseEvent) => handleDrag(e);
  const handleMouseUp = () => { isDragging.value = false; };

  useEventListener(document, 'mousemove', handleMouseMove);
  useEventListener(document, 'mouseup', handleMouseUp);
}

/** 滑块轨道样式类 */
const trackClasses = computed(() => {
  const base = 'relative h-2 bg-primary-200 dark:bg-primary-800 rounded-full cursor-pointer';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${base} ${disabledClass}`;
});

/** 滑块填充样式 */
const fillStyle = computed(() => ({
  width: `${percentage.value}%`,
}));

/** 滑块拇指样式类 */
const thumbClasses = computed(() => {
  const base = 'absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary-50 dark:bg-primary-950 border-2 border-primary-700 dark:border-primary-300 rounded-full shadow-md transition-transform duration-150';
  const hoverClass = !disabled ? 'hover:scale-110 active:scale-95' : '';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${base} ${hoverClass} ${disabledClass}`;
});
</script>

<template>
  <div
    ref="sliderRef"
    :class="trackClasses"
    @click="handleClick">
    <div
      class="absolute h-full bg-primary-700 dark:bg-primary-300 rounded-full"
      :style="fillStyle" />
    <div
      :class="thumbClasses"
      :style="{ left: `calc(${percentage}% - 8px)` }"
      @mousedown="startDrag" />
  </div>
</template>
