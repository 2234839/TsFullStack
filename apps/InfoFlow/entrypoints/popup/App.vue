

<template>
  <div class="w-96">
    <Config />
    <Login />
  </div>
  <Toast />
  <ConfirmPopup />
</template>
<script lang="ts" setup>
  import Config from '@/components/config.vue';
  import Login from '@/entrypoints/popup/login.vue';
  import { ConfirmPopup, Toast } from 'primevue';
  import { onMounted } from '#imports';
  import { API } from '@/utils/api';
  onMounted(() => {
    console.log(3333);

  });
</script>
<style scoped></style>
