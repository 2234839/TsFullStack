<template>
  <Button v-if="!authInfo_isLogin" @click="authInfo_logout($route.fullPath)">
    {{ $t('登录') }}
  </Button>
  <Button
    v-else
    v-memo="[]"
    icon="pi pi-power-off"
    class="p-button-rounded p-button-text p-button-plain"
    @click="authInfo_logout($route.fullPath)"
    v-tooltip="$t('退出')" />
</template>
<script setup lang="ts">
  import { authInfo_isLogin, authInfo_logout } from '@/storage';
  import { Button } from 'primevue';
</script>
