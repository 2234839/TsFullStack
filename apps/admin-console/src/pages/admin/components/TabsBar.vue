<template>
  <div
    class="tabs-bar bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-10 px-4 relative overflow-x-auto overflow-y-hidden">
    <div class="tabs-wrapper flex items-center h-full">
      <div
        v-for="tab of tabsStore.tabs"
        :key="tab.fullPath"
        :class="[
          'tab-item flex items-center h-8 px-2.5 mr-1 rounded cursor-pointer select-none whitespace-nowrap',
          tab.fullPath === tabsStore.activeTab
            ? 'bg-blue-50 dark:bg-blue-900 border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-300'
            : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600',
        ]"
        @click="handleTabClick(tab)"
        @contextmenu.prevent="handleContextMenu($event, tab)">
        <span class="tab-icon mr-1.5 flex items-center" v-if="tab.icon">
          <i :class="tab.icon"></i>
        </span>
        <span class="tab-title max-w-[120px] truncate">
          {{ tab.title }}
        </span>
        <span
          v-if="!tab.fixed"
          class="tab-close ml-1.5 flex items-center justify-center w-4 h-4 rounded-full opacity-60 hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-500"
          @click.stop="handleCloseTab(tab.fullPath)">
          <i class="pi pi-times text-xs"></i>
        </span>
      </div>
    </div>
    <ContextMenu ref="__contextMenu" :model="contextMenuItems" />
  </div>
</template>

<script setup lang="ts">
  import { useTabsStore, type TabItem } from '@/pages/admin/stores/tabsStore';
  import { ContextMenu } from 'primevue';
  import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';

  const router = useRouter();
  const route = useRoute();
  const tabsStore = useTabsStore();

  const currentContextTab = ref<TabItem | null>(null);
  const menuRef = useTemplateRef('__contextMenu');
  const contextMenuItems = computed(() => [
    {
      label: '刷新页面',
      icon: 'pi pi-refresh',
      command: handleRefresh,
    },
    {
      label: '关闭标签',
      icon: 'pi pi-times',
      command: () => handleCloseTab(currentContextTab.value?.path),
    },
    {
      label: '关闭其他标签',
      icon: 'pi pi-window-minimize',
      command: handleCloseOtherTabs,
    },
    {
      label: '关闭所有标签',
      icon: 'pi pi-times-circle',
      command: handleCloseAllTabs,
    },
  ]);

  watch(
    () => route,
    (newRoute) => {
      if (newRoute.meta.hideTab) return;
      tabsStore.addTab(newRoute);
    },
    { immediate: true, deep: true },
  );

  const handleTabClick = (tab: TabItem) => {
    if (tab.fullPath !== route.fullPath) {
      router.push(tab.fullPath);
    }
  };

  const handleCloseTab = (fullPath?: string) => {
    if (!fullPath || fullPath === '/') return;
    tabsStore.closeTab(fullPath, router);
  };

  const handleContextMenu = (e: MouseEvent, tab: TabItem) => {
    menuRef.value?.show(e);
    currentContextTab.value = tab;
  };

  const handleRefresh = () => {
    const { fullPath } = currentContextTab.value || {};
    if (fullPath) {
      router.replace({
        path: '/redirect',
        query: { path: fullPath },
      });
    }
  };

  const handleCloseOtherTabs = () => {
    if (currentContextTab.value) {
      tabsStore.closeOtherTabs(currentContextTab.value.path);
    }
  };

  const handleCloseAllTabs = () => {
    tabsStore.closeAllTabs(router);
  };
</script>

<style scoped>
  .tabs-bar::-webkit-scrollbar {
    height: 4px;
  }

  .tabs-bar::-webkit-scrollbar-track {
    background: transparent;
  }

  .tabs-bar::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
  }

  .tabs-bar::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  .dark .tabs-bar::-webkit-scrollbar-thumb {
    background: #4b5563;
  }

  .dark .tabs-bar::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
</style>
