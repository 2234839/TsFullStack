<template>
  <div class="min-w-10 p-4 text-nowrap pb-28">
    <Button @click="openOptionsPage()" :label="'打开配置页面'" />
  </div>
</template>

<script setup lang="ts">
  import { browser } from '#imports';
  import { Button } from 'primevue';

  function openOptionsPage() {
    browser.runtime.openOptionsPage();
  }
</script>
