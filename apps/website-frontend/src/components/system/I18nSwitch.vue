<style scoped></style>
<template>
  <Tooltip :content="t('切换语言')">
    <Dropdown v-model="menuOpen">
      <template #trigger>
        <Button variant="ghost"
          class="w-9 h-9 flex items-center justify-center rounded-full p-0!">
          <i class="pi pi-language"></i>
        </Button>
      </template>
      <div class="py-1">
        <Button variant="ghost" @click="switchI18n('zh-CN')"
          class="w-full justify-start">
          {{ t('中文') }}
        </Button>
        <Button variant="ghost" @click="switchI18n('en')"
          class="w-full justify-start">
          English
        </Button>
      </div>
    </Dropdown>
  </Tooltip>
</template>
<script setup lang="ts">
  import { loadLocaleMessages } from '@/i18n';
  import { i18nStore } from '@/storage';
  import { ref } from 'vue';
  import { useI18n } from '@/composables/useI18n';
  import { Dropdown, Tooltip } from '@tsfullstack/shared-frontend/components';

  const { t } = useI18n();
  const menuOpen = ref(false);

  function switchI18n(locale: typeof i18nStore.value) {
    i18nStore.value = locale;
    loadLocaleMessages(locale);
    menuOpen.value = false;
  }
</script>
