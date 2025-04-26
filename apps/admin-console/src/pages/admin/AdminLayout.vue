<template>
  <div class="flex h-screen w-full overflow-hidden">
    <!-- 侧边栏 -->
    <MenuSideBar class="h-screen flex-shrink-0" />

    <!-- 主内容区域 - 占据剩余宽度并添加滚动 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- 添加标签栏 -->
      <TabsBar />

      <!-- 内容区域 -->
      <div class="flex-1 overflow-hidden">
        <div class="h-full w-full overflow-auto">
          <RouterView :key="$route.fullPath" v-slot="{ Component }">
            <keep-alive>
              <component :is="Component" v-if="$route.meta.keepAlive" />
            </keep-alive>
            <component :is="Component" v-if="!$route.meta.keepAlive" />
          </RouterView>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import MenuSideBar from '@/pages/admin/components/MenuSideBar.vue';
  import TabsBar from '@/pages/admin/components/TabsBar.vue';
  import { provideTabsStore } from '@/pages/admin/stores/tabsStore';
  import { routeMap, routerUtil } from '@/router';
  import { authInfo_isLogin } from '@/storage';
  import { onMounted } from 'vue';
  provideTabsStore();
  onMounted(async () => {
    // 未登录，跳转到登录页面
    if (!authInfo_isLogin.value) {
      routerUtil.push(routeMap.login, {});
    }
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
