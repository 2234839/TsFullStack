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
            <!-- keepAlive 分支包 Suspense：DataBaseStudio 等组件的 setup 含顶层 await（异步 setup），
                 无 Suspense 边界时导航进入会静默渲染为空（白屏），直接刷新首屏则可能由外层兜住 -->
            <keep-alive>
              <Suspense>
                <component :is="Component" v-if="$route.meta.keepAlive" />
              </Suspense>
            </keep-alive>
            <Suspense>
              <component :is="Component" v-if="!$route.meta.keepAlive" />
            </Suspense>
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
import { useRoute } from 'vue-router';

/** 当前路由（登录回跳用） */
const route = useRoute();
import { authInfo_isLogin } from '@/storage';
import { onMounted } from 'vue';
provideTabsStore();

onMounted(async () => {
  /** 未登录则跳转到登录页 */
  if (!authInfo_isLogin.value) {
    routerUtil.push(routeMap.login, {}, { r: route.fullPath });
  }
});
</script>
