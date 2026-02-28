<script setup lang="ts">
/**
 * 滑块组件
 * 使用 Tailwind CSS 样式
 */
import { computed, ref } from 'vue';

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
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

/** 内部状态 */
const isDragging = ref(false);
const sliderRef = ref<HTMLElement | null>(null);

/** 当前值的百分比 */
const percentage = computed(() => {
  const range = props.max - props.min;
  const value = Math.max(props.min, Math.min(props.max, props.modelValue ?? props.min));
  return ((value - props.min) / range) * 100;
});

/** 处理滑块拖动 */
function handleDrag(event: MouseEvent) {
  if (!sliderRef.value || props.disabled) return;

  const rect = sliderRef.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const width = rect.width;

  let percentage = (x / width) * 100;
  percentage = Math.max(0, Math.min(100, percentage));

  const range = props.max - props.min;
  let value = props.min + (percentage / 100) * range;

  // 对齐到步长
  value = Math.round(value / props.step) * props.step;
  value = Math.max(props.min, Math.min(props.max, value));

  emit('update:modelValue', value);
}

/** 处理滑块轨道点击 */
function handleClick(event: MouseEvent) {
  if (props.disabled) return;
  handleDrag(event);
}

/** 开始拖动 */
function startDrag(event: MouseEvent) {
  if (props.disabled) return;
  isDragging.value = true;
  event.preventDefault();

  const handleMouseMove = (e: MouseEvent) => handleDrag(e);
  const handleMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

/** 滑块轨道样式类 */
const trackClasses = computed(() => {
  const base = 'relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer';
  const disabledClass = props.disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${base} ${disabledClass}`;
});

/** 滑块填充样式 */
const fillStyle = computed(() => ({
  width: `${percentage.value}%`,
}));

/** 滑块拇指样式类 */
const thumbClasses = computed(() => {
  const base = 'absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-primary-500 rounded-full shadow-md transition-transform duration-150';
  const hoverClass = !props.disabled ? 'hover:scale-110 active:scale-95' : '';
  const disabledClass = props.disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${base} ${hoverClass} ${disabledClass}`;
});
</script>

<template>
  <div
    ref="sliderRef"
    :class="trackClasses"
    @click="handleClick">
    <div
      class="absolute h-full bg-primary-500 dark:bg-primary-400 rounded-full"
      :style="fillStyle">
      <div
        :class="thumbClasses"
        :style="{ left: `calc(${percentage}% - 8px)` }"
        @mousedown="startDrag" />
    </div>
  </div>
</template>
