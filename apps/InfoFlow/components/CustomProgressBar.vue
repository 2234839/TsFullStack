<template>
  <div class="relative w-full h-3 bg-gray-300 rounded-full overflow-hidden">
    <div
      class="absolute top-0 left-0 h-full bg-blue-400 rounded-full transition-all duration-300 ease-out"
      :style="{ width: `${value}%` }"></div>
    <div
      class="absolute top-0 left-0 w-full h-full flex items-center justify-center text-xs font-medium text-white pointer-events-none">
      <slot>
        {{ text || `${value}%` }}
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    value: number;
    text?: string;
  }

  defineProps<Props>();
</script>
