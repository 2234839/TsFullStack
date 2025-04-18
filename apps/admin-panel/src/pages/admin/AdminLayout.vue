<template>
  <div class="flex h-screen w-full overflow-hidden">
    <!-- 侧边栏 -->
    <MenuSideBar class="h-screen flex-shrink-0" />

    <!-- 主内容区域 - 占据剩余宽度并添加滚动 -->
    <div class="flex-1 overflow-hidden">
      <div class="h-full w-full overflow-auto">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { API } from '@/api';
  import MenuSideBar from '@/pages/admin/components/MenuSideBar.vue';
  import { routeMap, routerUtil } from '@/router';
  import { authInfo_isLogin } from '@/storage';
  import { onMounted } from 'vue';

  onMounted(async () => {
    // 未登录，跳转到登录页面
    if (!authInfo_isLogin.value) {
      routerUtil.push(routeMap.login, {});
    }
    // 示例：转换一个文本为 File
    const text = 'Hello, world!';
    const blob = new Blob([text], { type: 'text/plain' });
    ;

    const r = await API.system.upload(new File([blob], 'hello.txt', { type: 'text/plain' }));
    console.log('[r]', r);
  });
</script>

<style scoped>
  /* 自定义滚动条样式 */
  .overflow-auto::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .overflow-auto::-webkit-scrollbar-track {
    background: transparent;
  }

  .overflow-auto::-webkit-scrollbar-thumb {
    background-color: rgba(100, 116, 139, 0.3);
    border-radius: 3px;
  }

  .overflow-auto::-webkit-scrollbar-thumb:hover {
    background-color: rgba(100, 116, 139, 0.5);
  }
</style>
