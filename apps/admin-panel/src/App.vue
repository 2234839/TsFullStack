<style scoped></style>
<template>
  <Button>33</Button>
  {{ modelMeta.state }}
</template>
<script setup lang="ts">
  import Button from 'primevue/button';
  import { API, AppAPI } from './api';
  import { useAsyncState } from '@vueuse/core';

  const modelMeta = useAsyncState(() => {
    // return API.system.getModelMeta();
    return AppAPI.__effect__();
  }, undefined);
</script>
