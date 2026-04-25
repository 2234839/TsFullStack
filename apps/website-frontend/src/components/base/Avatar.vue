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

const { size = 'normal', shape = 'circle', disabled = false } = defineProps<Props>();

/** 尺寸映射（静态常量） */
const AVATAR_SIZE_CLASSES: Record<string, string> = {
  normal: 'w-8 h-8',
  large: 'w-12 h-12',
  xlarge: 'w-16 h-16',
};

/** 头像样式类 */
const avatarClasses = computed(() => {
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-md';
  const disabledClass = disabled ? 'opacity-50' : '';
  return `${AVATAR_SIZE_CLASSES[size]} ${shapeClass} ${disabledClass} overflow-hidden bg-primary-200 dark:bg-primary-800`;
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
      class="flex items-center justify-center w-full h-full text-sm font-medium text-primary-600 dark:text-primary-400">
      {{ label.charAt(0).toUpperCase() }}
    </span>
    <slot />
  </div>
</template>
