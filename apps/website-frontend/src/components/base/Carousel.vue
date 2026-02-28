<!--
 * 简单的轮播图组件，替代 PrimeVue Carousel
-->
<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props<T = any> {
  value?: T[];
  numVisible?: number;
  numScroll?: number;
  circular?: boolean;
  autoplayInterval?: number;
}

const props = withDefaults(defineProps<Props>(), {
  value: () => [],
  numVisible: 1,
  numScroll: 1,
  circular: false,
  autoplayInterval: 0,
});

const currentIndex = ref(0);

const totalSlides = computed(() => Math.ceil((props.value?.length || 0) / props.numVisible));

const canGoPrev = computed(() => props.circular || currentIndex.value > 0);
const canGoNext = computed(() => props.circular || currentIndex.value < totalSlides.value - 1);

function next() {
  if (canGoNext.value) {
    if (currentIndex.value >= totalSlides.value - 1) {
      if (props.circular) {
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
      if (props.circular) {
        currentIndex.value = totalSlides.value - 1;
      }
    } else {
      currentIndex.value--;
    }
  }
}

const visibleItems = computed(() => {
  if (!props.value) return [];
  const start = currentIndex.value * props.numVisible;
  const end = start + props.numVisible;
  return props.value.slice(start, end);
});

// 自动播放
if (props.autoplayInterval > 0) {
  setInterval(() => {
    next();
  }, props.autoplayInterval);
}
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
        class="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 rounded-full p-2 shadow-lg transition-colors"
        aria-label="上一张"
      >
        <i class="pi pi-chevron-left text-gray-700 dark:text-gray-300"></i>
      </button>

      <button
        v-if="canGoNext"
        @click="next"
        class="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 rounded-full p-2 shadow-lg transition-colors"
        aria-label="下一张"
      >
        <i class="pi pi-chevron-right text-gray-700 dark:text-gray-300"></i>
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
            ? 'bg-white dark:bg-gray-200'
            : 'bg-white/50 dark:bg-gray-200/50'
        "
        :aria-label="`第 ${index + 1} 张`"
      ></button>
    </div>
  </div>
</template>
