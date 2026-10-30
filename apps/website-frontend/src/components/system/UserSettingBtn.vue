<template>
  <Button v-if="!authInfo_isLogin" @click="authInfo_logout(route.fullPath)" variant="text">
    {{ t('登录') }}
  </Button>
  <template v-else>
    <Tooltip :content="t('账号设置')">
      <Button
        v-memo="[]"
        icon="pi pi-user-edit"
        rounded
        variant="text"
        @click="routerUtil.push(routeMap.account, {})"
      />
    </Tooltip>
    <Tooltip :content="t('退出登录')">
      <Button v-memo="[]" icon="pi pi-power-off" rounded variant="text" @click="authInfo_logout(route.fullPath)" />
    </Tooltip>
  </template>
</template>
<script setup lang="ts">
import { authInfo_isLogin, authInfo_logout } from '@/storage';
import { Tooltip } from '@tsfullstack/shared-frontend/components';
import { useI18n } from '@/composables/useI18n';
import { routeMap, routerUtil } from '@/router';
import { useRoute } from 'vue-router';

const { t } = useI18n();
const route = useRoute();
</script>
