<style scoped></style>
<template>
  <Button>33</Button>
  {{ modelMeta.state }}
</template>
<script setup lang="ts">
  import Button from 'primevue/button';
  import { API } from './api';
  import { useAsyncState } from '@vueuse/core';

  const modelMeta = useAsyncState(() => {
    return API.system.getModelMeta();
  }, undefined);
</script>
