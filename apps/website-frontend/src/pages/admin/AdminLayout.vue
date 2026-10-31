<template>
  <div class="flex h-screen w-full overflow-hidden bg-primary-surface">
    <!-- 侧边栏：桌面端常驻，移动端收进 Drawer 抽屉，内容区占满全宽 -->
    <MenuSideBar v-if="!isMobile" class="h-screen shrink-0" />
    <Drawer v-else v-model:open="sidebarVisible" side="left" width="280px">
      <MenuSideBar force-expanded class="h-screen" />
    </Drawer>

    <!-- 主内容区域 - 占据剩余宽度并添加滚动 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- 添加标签栏 -->
      <TabsBar>
        <template #left>
          <button
            v-if="isMobile"
            class="flex items-center justify-center w-8 h-8 mr-2 rounded cursor-pointer text-primary-600 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-600"
            :aria-label="t('打开菜单')"
            @click="sidebarVisible = true"
          >
            <i class="pi pi-bars"></i>
          </button>
        </template>
      </TabsBar>

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
import { Drawer } from '@tsfullstack/shared-frontend/components';
import { provideTabsStore } from '@/pages/admin/stores/tabsStore';
import { routeMap, routerUtil } from '@/router';
import { useI18n } from '@/composables/useI18n';
import { useMediaQuery } from '@vueuse/core';
import { useRoute } from 'vue-router';
import { ref, watch } from 'vue';

const { t } = useI18n();

/** 当前路由（登录回跳用） */
const route = useRoute();

/** 移动端判定：侧边栏收进抽屉，给内容区让出全部宽度 */
const isMobile = useMediaQuery('(max-width: 1023px)');

/** 移动端侧边栏抽屉开关 */
const sidebarVisible = ref(false);

/** 移动端完成导航后自动收起抽屉，内容即所见 */
watch(
  () => route.fullPath,
  () => {
    sidebarVisible.value = false;
  },
);
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
