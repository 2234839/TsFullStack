<style>
  html {
    font-size: 14px;
  }
</style>
<template>
  <RouterView />
  <Toast />
  <ConfirmPopup />
</template>
<script setup lang="ts">
  import { Toast, ConfirmPopup } from 'primevue';
</script>
