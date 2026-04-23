<!--
 * 简单的轮播图组件，替代 PrimeVue Carousel
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useIntervalFn } from '@vueuse/core';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

interface Props<T = unknown> {
  value?: T[];
  numVisible?: number;
  circular?: boolean;
  autoplayInterval?: number;
}

const { value = [] as unknown[], numVisible = 1, circular = false, autoplayInterval = 0 } = defineProps<Props>();

const currentIndex = ref(0);

const totalSlides = computed(() => Math.ceil((value?.length || 0) / numVisible));

const canGoPrev = computed(() => circular || currentIndex.value > 0);
const canGoNext = computed(() => circular || currentIndex.value < totalSlides.value - 1);

function next() {
  if (canGoNext.value) {
    if (currentIndex.value >= totalSlides.value - 1) {
      if (circular) {
        currentIndex.value = 0;
      }
    } else {
      currentIndex.value++;
    }
  }
}

function prev() {
  if (canGoPrev.value) {
    if (currentIndex.value <= 0) {
      if (circular) {
        currentIndex.value = totalSlides.value - 1;
      }
    } else {
      currentIndex.value--;
    }
  }
}

const visibleItems = computed(() => {
  if (!value) return [];
  const start = currentIndex.value * numVisible;
  const end = start + numVisible;
  return value.slice(start, end);
});

// 自动播放（useIntervalFn 自动在组件卸载时清理）
useIntervalFn(
  () => next(),
  () => autoplayInterval,
  { immediate: autoplayInterval > 0 },
);
</script>

<template>
  <div class="relative overflow-hidden">
    <!-- 轮播内容 -->
    <div class="flex transition-transform duration-300">
      <slot name="item" :data="visibleItems[0]"></slot>
    </div>

    <!-- 导航按钮 -->
    <template v-if="totalSlides > 1">
      <button
        v-if="canGoPrev"
        @click="prev"
        class="absolute left-2 top-1/2 -translate-y-1/2 bg-primary-50/80 dark:bg-primary-950/80 hover:bg-primary-50 dark:hover:bg-primary-950 rounded-full p-2 shadow-lg transition-colors"
        :aria-label="t('上一张')"
      >
        <i class="pi pi-chevron-left text-primary-800 dark:text-primary-200"></i>
      </button>

      <button
        v-if="canGoNext"
        @click="next"
        class="absolute right-2 top-1/2 -translate-y-1/2 bg-primary-50/80 dark:bg-primary-950/80 hover:bg-primary-50 dark:hover:bg-primary-950 rounded-full p-2 shadow-lg transition-colors"
        :aria-label="t('下一张')"
      >
        <i class="pi pi-chevron-right text-primary-800 dark:text-primary-200"></i>
      </button>
    </template>

    <!-- 指示器 -->
    <div v-if="totalSlides > 1" class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
      <button
        v-for="(_, index) in totalSlides"
        :key="index"
        @click="currentIndex = index"
        class="w-2 h-2 rounded-full transition-colors"
        :class="
          index === currentIndex
            ? 'bg-primary-50 dark:bg-primary-200'
            : 'bg-primary-50/50 dark:bg-primary-200/50'
        "
        :aria-label="t('第 N 张', { n: index + 1 })"
      ></button>
    </div>
  </div>
</template>
