<template>
  <div
    @click="toggleTheme"
    v-tooltip="$t('切换主题')"
    class="w-9 h-9 flex items-center justify-center aspect-ratio rounded-full transition-colors duration-300"
    :class="
      theme_isDark
        ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
        : 'bg-white text-gray-800 hover:bg-gray-100'
    ">
    <i :class="theme_isDark ? 'pi pi-sun' : 'pi pi-moon'" class="text-xl" />
  </div>
</template>

<script setup lang="ts">
  import { theme_isDark } from '@/storage';

  const toggleTheme = () => {
    theme_isDark.value = !theme_isDark.value;
  };
</script>
