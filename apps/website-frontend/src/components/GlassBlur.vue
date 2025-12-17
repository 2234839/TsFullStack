<template>
  <div
    class="group relative cursor-pointer transition-all duration-300 overflow-hidden"
    :class="containerClass"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave">
    <!-- 默认状态的模糊遮罩 -->
    <div
      v-if="isBlurred && showOverlay"
      class="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
      :class="overlayClass">
      <div class="text-sm font-medium" :class="overlayTextClass">
        {{ overlayText }}
      </div>
    </div>

    <!-- 被包裹的内容 -->
    <div
      class="transition-all duration-300"
      :class="{
        'blur-sm scale-105 select-none': isBlurred,
        'blur-none scale-100 select-text': !isBlurred
      }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watchEffect } from 'vue';

  interface Props {
    /** 初始是否模糊状态，默认为 true */
    initialBlurred?: boolean;
    /** 遮罩层提示文字 */
    overlayText?: string;
    /** 是否显示遮罩层，默认为 true */
    showOverlay?: boolean;
    /** 容器的额外CSS类 */
    containerClass?: string;
    /** 遮罩层的额外CSS类 */
    overlayClass?: string;
    /** 遮罩层文字的额外CSS类 */
    overlayTextClass?: string;
    /** 点击时是否切换模糊状态，默认为 true */
    toggleOnClick?: boolean;
    /** 用户交互后是否保持清晰状态（不再模糊），默认为 true */
    autoClear?: boolean;
  }

  const {
    initialBlurred = true,
    overlayText = '鼠标悬停或点击查看',
    showOverlay = true,
    toggleOnClick = true,
    autoClear = true,
    containerClass = '',
    overlayClass = 'bg-white/60 backdrop-blur-[1px]',
    overlayTextClass = 'text-gray-700/80'
  } = defineProps<Props>();

  const isBlurred = ref(initialBlurred);
  const hasInteracted = ref(false);

  const handleClick = () => {
    if (toggleOnClick) {
      hasInteracted.value = true;
      if (autoClear) {
        // 自动清除模式下，交互后永远保持清晰
        isBlurred.value = false;
      } else {
        // 非自动清除模式，可以切换状态
        isBlurred.value = !isBlurred.value;
      }
    }
  };

  const handleMouseEnter = () => {
    // 标记为已交互
    if (autoClear) {
      hasInteracted.value = true;
    }
    // 变清晰
    isBlurred.value = false;
  };

  const handleMouseLeave = () => {
    if (autoClear && hasInteracted.value) {
      // 已经交互过且是自动清除模式，保持清晰
      isBlurred.value = false;
    } else if (!autoClear) {
      // 非自动清除模式，鼠标离开时恢复模糊
      isBlurred.value = true;
    } else {
      // 自动清除模式但未交互过，鼠标离开时恢复模糊
      isBlurred.value = true;
    }
  };

  // 监听 initialBlurred 变化 - Vue 3.5+ 会自动将 initialBlurred 转换为 props.initialBlurred
  watchEffect(() => {
    isBlurred.value = initialBlurred;
    hasInteracted.value = false; // 重置交互状态
  });
</script>