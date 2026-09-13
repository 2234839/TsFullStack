<script setup lang="ts">
/**
 * 头像组件
 * 基于 reka-ui AvatarRoot/AvatarImage/AvatarFallback primitives，
 * 图片加载失败时自动回退到文字/插槽
 *
 * @example
 * ```vue
 * <Avatar image="/a.png" label="张三" size="large" />
 * ```
 */
import { AvatarRoot, AvatarImage, AvatarFallback } from "reka-ui";
import { ref } from "vue";

/** 图片加载状态（reka 的 ImageLoadingStatus 含 idle，无 image 时视为 error 以直接显示回退） */
const imgStatus = ref<"idle" | "error" | "loaded" | "loading">("loading");

defineOptions({ inheritAttrs: false });

interface Props {
  /** 图片地址 */
  image?: string;
  /** 标签（回退文字取首字符） */
  label?: string;
  /** 大小 */
  size?: "normal" | "large" | "xlarge";
  /** 形状 */
  shape?: "circle" | "square";
  /** 延迟显示回退内容（毫秒） */
  fallbackDelay?: number;
  /** 是否禁用 */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: "normal",
  shape: "circle",
  fallbackDelay: 0,
  disabled: false,
});

/** 尺寸映射（静态常量） */
const AVATAR_SIZE_CLASSES: Record<string, string> = {
  normal: "w-8 h-8",
  large: "w-12 h-12",
  xlarge: "w-16 h-16",
};
</script>

<template>
  <AvatarRoot
    v-bind="$attrs"
    class="relative overflow-hidden bg-primary-200 dark:bg-primary-800 flex shrink-0"
    :class="[
      AVATAR_SIZE_CLASSES[size],
      shape === 'circle' ? 'rounded-full' : 'rounded-md',
      disabled ? 'opacity-50' : '',
    ]"
  >
    <AvatarImage
      v-if="image"
      :src="image"
      :alt="label"
      class="h-full w-full object-cover"
      @loading-status-change="imgStatus = $event"
    />
    <AvatarFallback
      v-if="image"
      :delay-ms="fallbackDelay"
      class="flex h-full w-full items-center justify-center text-sm font-medium text-primary-theme"
    >
      <slot>
        {{ label?.charAt(0).toUpperCase() }}
      </slot>
    </AvatarFallback>
    <!-- 无图片时直接渲染回退内容（reka AvatarFallback 依赖图片状态机，无 image 时不会显示） -->
    <span
      v-else
      class="flex h-full w-full items-center justify-center text-sm font-medium text-primary-theme"
    >
      <slot>
        {{ label?.charAt(0).toUpperCase() }}
      </slot>
    </span>
  </AvatarRoot>
</template>
