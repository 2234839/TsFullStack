<style scoped></style>
<template>
  <Tooltip :content="t('切换语言')" side="right">
    <button @click="toggleLanguageMenu"
      class="w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400">
      <i class="pi pi-language "></i>
    </button>
  </Tooltip>
  <Dropdown v-model:open="menuOpen">
    <template #trigger>
      <div style="display: none;"></div>
    </template>
    <div class="py-1">
      <button @click="switchI18n('zh-CN')"
        class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        中文
      </button>
      <button @click="switchI18n('en')"
        class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        English
      </button>
    </div>
  </Dropdown>
</template>
<script setup lang="ts">
  import { loadLocaleMessages } from '@/i18n';
  import { i18nStore } from '@/storage';
  import { ref } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { Tooltip, Dropdown } from '@tsfullstack/shared-frontend/components';

  const { t } = useI18n();
  const menuOpen = ref(false);

  const toggleLanguageMenu = () => {
    menuOpen.value = !menuOpen.value;
  };

  function switchI18n(locale: typeof i18nStore.value) {
    i18nStore.value = locale;
    loadLocaleMessages(locale);
    menuOpen.value = false;
  }
</script>
