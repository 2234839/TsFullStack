<style scoped></style>
<template>
  <h1>Admin Layout</h1>
  <RouterView />
</template>
<script setup lang="ts">
  import { onMounted } from 'vue';
  import { routeMap, routerUtil } from '../../router';
  import { authInfo_isLogin } from '../../storage';

  onMounted(() => {
    // 未登录，跳转到登录页面
    if (!authInfo_isLogin.value) {
      routerUtil.push(routeMap.login, {});
    }
  });
</script>
