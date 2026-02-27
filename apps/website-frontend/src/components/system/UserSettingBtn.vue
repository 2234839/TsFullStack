<template>
  <Button v-if="!authInfo_isLogin" @click="authInfo_logout(route.fullPath)">
    {{ t('登录') }}
  </Button>
  <Tooltip v-else :content="t('退出登录')">
    <Button
      v-memo="[]"
      icon="pi pi-power-off"
      class="p-button-rounded p-button-text p-button-plain"
      @click="authInfo_logout(route.fullPath)" />
  </Tooltip>
</template>
<script setup lang="ts">
  import { authInfo_isLogin, authInfo_logout } from '@/storage';
  import { Button } from 'primevue';
  import { Tooltip } from '@tsfullstack/shared-frontend/components';
  import { useI18n } from '@/composables/useI18n';
  import { useRoute } from 'vue-router';

  const { t } = useI18n();
  const route = useRoute();
</script>
