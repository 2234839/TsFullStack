<style scoped></style>
<template>
  <RouterView />
</template>
<script setup lang="ts">
  import { onMounted } from 'vue';
  import { authInfo } from '../storage';
  import { routeMap, routerUtil } from '../router';

  onMounted(() => {
    if (!authInfo.value) {
      routerUtil.push(routeMap.login, {});
    }
  });
</script>
