<template>
  <button
    @click="toggleTheme"
    class="p-2 rounded-full transition-colors duration-300"
    :class="
      isDark
        ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
        : 'bg-white text-gray-800 hover:bg-gray-100'
    ">
    <i :class="isDark ? 'pi pi-sun' : 'pi pi-moon'" class="text-xl"></i>
  </button>
</template>

<script setup lang="ts">
  import { theme_isDark } from '@/storage';

  const isDark = theme_isDark;

  // 切换主题
  const toggleTheme = () => {
    isDark.value = !isDark.value;
  };
</script>
