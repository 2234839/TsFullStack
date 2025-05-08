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
  import { API, setApiTempToast } from '@/api';
  import GithubStar from '@/components/system/GithubStar.vue';
  import { ConfirmPopup, Toast, useToast } from 'primevue';

  const toast = useToast();
  setApiTempToast(toast); // 设置全局 toast 实例


</script>
