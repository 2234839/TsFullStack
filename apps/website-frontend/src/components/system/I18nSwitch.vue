<style scoped></style>
<template>
  <Button
    icon="pi pi-language"
    class="p-button-rounded p-button-text p-button-plain"
    v-tooltip.right="t('切换语言')"
    @click="toggleLanguageMenu" />
  <Menu ref="__languageMenu" :model="languageItems" :popup="true" />
</template>
<script setup lang="ts">
  import { loadLocaleMessages } from '@/i18n';
  import { i18nStore } from '@/storage';
  import { Button, Menu } from 'primevue';
  import { ref, useTemplateRef } from 'vue';
  import { useI18n } from 'vue-i18n';
  const { t } = useI18n();
  const languageMenu = useTemplateRef('__languageMenu');
  const languageItems = ref([
    { label: '中文', command: () => switchI18n('zh-CN') },
    { label: 'English', command: () => switchI18n('en') },
  ]);

  const toggleLanguageMenu = (event: Event) => {
    languageMenu.value?.toggle(event);
  };
  function switchI18n(locale: typeof i18nStore.value) {
    i18nStore.value = locale;
    loadLocaleMessages(locale);
  }
</script>
