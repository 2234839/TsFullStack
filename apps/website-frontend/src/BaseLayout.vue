<style>
  html {
    font-size: 14px;
  }
</style>
<template>
  <RouterView v-slot="{ Component }">
    <template v-if="Component">
      <Transition mode="out-in">
        <KeepAlive>
          <Suspense>
            <!-- 主要内容 -->
            <component :is="Component"></component>
            <!-- 加载中状态 -->
            <template #fallback> 正在加载... </template>
          </Suspense>
        </KeepAlive>
      </Transition>
    </template>
  </RouterView>

  <Toast />
  <ConfirmPopup />
  <GithubStar />
</template>
<script setup lang="ts">
  import { setApiTempToast } from '@/api';
  import GithubStar from '@/components/system/GithubStar.vue';
  import { allRoutes, findRouteNode } from '@/router';
  import { useTitle } from '@vueuse/core';
  import { ConfirmPopup, Toast, useToast } from 'primevue';
  import { computed } from 'vue';
  import { useRoute } from 'vue-router';

  const toast = useToast();
  setApiTempToast(toast); // 设置全局 toast 实例

  //#region 设置页面标题
  const route = useRoute();
  const routeNode = findRouteNode(allRoutes, (el) => el.name === route.name)!;
  const title = computed(() => {
    return routeNode?.meta?.title ? `${routeNode.meta.title} - TSFullStack` : 'TSFullStack';
  });
  useTitle(title);
  //#endregion
</script>
