<template>
  <div class="flex h-screen w-full overflow-hidden bg-primary-surface">
    <!-- 侧边栏 -->
    <MenuSideBar class="h-screen shrink-0" />

    <!-- 主内容区域 - 占据剩余宽度并添加滚动 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- 添加标签栏 -->
      <TabsBar />

      <!-- 内容区域 -->
      <div class="flex-1 overflow-hidden">
        <div class="h-full w-full overflow-auto custom-scrollbar">
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
  import { authInfo, authInfo_isLogin } from '@/storage';
  import { onMounted } from 'vue';
  provideTabsStore();

  /** 检查当前用户是否拥有 admin 角色 */
  const isAdmin = () => authInfo.value?.user?.role?.some((r: { name: string }) => r.name === 'admin') ?? false;

  onMounted(async () => {
    /** 未登录或非管理员，跳转到首页 */
    if (!authInfo_isLogin.value || !isAdmin()) {
      routerUtil.push(routeMap.login, {});
    }
  });
</script>


