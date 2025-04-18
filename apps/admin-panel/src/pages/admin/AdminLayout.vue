<style scoped></style>
<template>
  <div class="flex">
    <MenuSideBar />
    <RouterView />
  </div>
</template>
<script setup lang="ts">
  import { onMounted } from 'vue';
  import { routeMap, routerUtil } from '@/router';
  import { authInfo_isLogin } from '@/storage';
  import MenuSideBar from '@/pages/admin/components/MenuSideBar.vue';

  onMounted(() => {
    // 未登录，跳转到登录页面
    if (!authInfo_isLogin.value) {
      routerUtil.push(routeMap.login, {});
    }
  });
</script>
