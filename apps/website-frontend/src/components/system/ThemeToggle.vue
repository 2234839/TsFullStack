<template>
  <Tooltip :content="tooltipText">
    <div
      @click="toggleThemeMode"
      class="w-9 h-9 flex items-center justify-center aspect-ratio rounded-full transition-colors duration-300 cursor-pointer"
      :class="themeButtonClass">
      <i :class="themeIcon" class="text-xl" />
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
        return 'bg-gray-800 text-yellow-400 hover:bg-gray-700';
      case 'random':
        return 'bg-gradient-to-br from-pink-500 to-orange-400 text-white hover:from-pink-600 hover:to-orange-500';
      case 'light':
      default:
        return 'bg-white text-gray-800 hover:bg-gray-100';
    }
  });

  /** 主题图标 */
  const themeIcon = computed(() => {
    switch (currentMode.value) {
      case 'dark':
        return 'pi pi-sun';
      case 'random':
        return 'pi pi-spin pi-sync';
      case 'light':
      default:
        return 'pi pi-moon';
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
