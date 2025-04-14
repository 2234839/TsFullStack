<style scoped></style>
<template>
  <RouterView />
</template>
<script setup lang="ts">
  import { onMounted } from 'vue';
  import { routeMap, routerUtil } from '../router';
  import { authInfo_isLogin } from '../storage';

  onMounted(() => {
    if (!authInfo_isLogin.value) {
      routerUtil.push(routeMap.login, {});
    }
  });
</script>
