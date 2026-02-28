<script setup lang="ts">
/**
 * 头像组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 图片地址 */
  image?: string;
  /** 标签 */
  label?: string;
  /** 大小 */
  size?: 'normal' | 'large' | 'xlarge';
  /** 形状 */
  shape?: 'circle' | 'square';
  /** 是否禁用 */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'normal',
  shape: 'circle',
  disabled: false,
});

/** 头像样式类 */
const avatarClasses = computed(() => {
  const sizeClasses = {
    normal: 'w-8 h-8',
    large: 'w-12 h-12',
    xlarge: 'w-16 h-16',
  };

  const shapeClass = props.shape === 'circle' ? 'rounded-full' : 'rounded-md';

  const disabledClass = props.disabled ? 'opacity-50' : '';

  return `${sizeClasses[props.size]} ${shapeClass} ${disabledClass} overflow-hidden bg-gray-200 dark:bg-gray-700`;
});

/** 图片样式 */
const imageClasses = 'w-full h-full object-cover';
</script>

<template>
  <div :class="avatarClasses">
    <img
      v-if="image"
      :src="image"
      :alt="label"
      :class="imageClasses" />
    <span
      v-else-if="label"
      class="flex items-center justify-center w-full h-full text-sm font-medium text-gray-600 dark:text-gray-400">
      {{ label.charAt(0).toUpperCase() }}
    </span>
    <slot />
  </div>
</template>
