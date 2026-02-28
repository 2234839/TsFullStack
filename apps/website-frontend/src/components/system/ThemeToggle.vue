<template>
  <Tooltip :content="tooltipText">
    <div @click="toggleThemeMode"
      class="w-8 h-8 flex items-center justify-center aspect-ratio rounded-full transition-colors duration-300 cursor-pointer"
      :class="themeButtonClass">
      <span v-html="themeIcon"></span>
    </div>
  </Tooltip>
</template>

<script setup lang="ts">
  import { theme_isDark, theme_randomMode } from '@/storage';
  import { Tooltip } from '@tsfullstack/shared-frontend/components';
  import { useI18n } from '@/composables/useI18n';
  import { computed } from 'vue';

  const { t } = useI18n();

  /** 主题模式：'light' | 'dark' | 'random' */
  type ThemeMode = 'light' | 'dark' | 'random';

  /** 当前主题模式 */
  const currentMode = computed<ThemeMode>(() => {
    if (!import.meta.env.DEV) {
      return theme_isDark.value ? 'dark' : 'light';
    }
    if (theme_randomMode.value) {
      return 'random';
    }
    return theme_isDark.value ? 'dark' : 'light';
  });

  /** 主题按钮样式类 */
  const themeButtonClass = computed(() => {
    switch (currentMode.value) {
      case 'dark':
        return 'bg-gray-800 text-warning-400 hover:bg-gray-700';
      case 'random':
        return 'bg-linear-to-br from-pink-500 to-orange-400 text-white hover:from-pink-600 hover:to-orange-500';
      case 'light':
      default:
        return 'bg-white text-gray-800 hover:bg-gray-100';
    }
  });

  /** 主题图标 (使用 SVG 替代 PrimeIcons) */
  const themeIcon = computed(() => {
    switch (currentMode.value) {
      case 'dark':
        // 太阳图标
        return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
      case 'random':
        // 随机/刷新图标
        return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`;
      case 'light':
      default:
        // 月亮图标
        return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    }
  });

  /** 提示文本 */
  const tooltipText = computed(() => {
    if (!import.meta.env.DEV) {
      return t('切换主题');
    }
    switch (currentMode.value) {
      case 'dark':
        return t('暗夜模式');
      case 'random':
        return t('随机主题（每次刷新随机切换）');
      case 'light':
      default:
        return t('明亮模式');
    }
  });

  /** 切换主题模式 */
  const toggleThemeMode = () => {
    if (!import.meta.env.DEV) {
      // 生产环境：仅在明亮和暗夜之间切换
      theme_isDark.value = !theme_isDark.value;
      return;
    }

    // 开发环境：明亮 -> 暗夜 -> 随机 -> 明亮 循环
    switch (currentMode.value) {
      case 'light':
        theme_isDark.value = true;
        theme_randomMode.value = false;
        break;
      case 'dark':
        theme_isDark.value = true;
        theme_randomMode.value = true;
        break;
      case 'random':
        theme_isDark.value = false;
        theme_randomMode.value = false;
        break;
    }
  };
</script>
