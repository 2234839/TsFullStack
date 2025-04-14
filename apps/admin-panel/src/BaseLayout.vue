<style scoped></style>
<template>
  <RouterView />
  <Toast />
</template>
<script setup lang="ts">
import { Toast } from 'primevue'

  // import { API, AppAPI } from './api';
  // import { useAsyncState } from '@vueuse/core';

  // const modelMeta = useAsyncState(() => {
  //   return AppAPI.__effect__();
  // }, undefined);
</script>
