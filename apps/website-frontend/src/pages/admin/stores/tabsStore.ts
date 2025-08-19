import { allRoutes, findRouteNode } from '@/router';
import {
  computed,
  type ComputedRef,
  inject,
  type InjectionKey,
  provide,
  reactive,
  readonly,
  ref,
} from 'vue';
import { type RouteLocationNormalizedLoaded } from 'vue-router';

/** 标签页的元信息，用于多页签的展示和控制 */
export interface RouteMetaTabs {
  icon?: string;
  title?: string;
  keepAlive?: boolean;
  /** 固定标签无法关闭 */
  fixed?: boolean;
  /** 隐藏标签页 */
  hideTab?: boolean;
}
/** 用于多页签的控制 */
export interface TabItem extends RouteMetaTabs {
  path: string;
  fullPath: string;
  name: string;
}

// 创建一个注入键
export const TabsStoreKey: InjectionKey<ReturnType<typeof createTabsStore>> = Symbol('TabsStore');

export function createTabsStore() {
  // 所有打开的页签
  const tabs = ref<ComputedRef<TabItem>[]>([]);
  // 当前激活的页签路径
  const activeTab = ref('');

  // 添加页签
  const addTab = (route: RouteLocationNormalizedLoaded) => {
    const { path, fullPath, name } = route;
    // 因为 vue route 丢失了 meta 的响应式，所以需要重新从 routeMap 获取 meta 信息
    const routerNode = findRouteNode(allRoutes, (el) => el.name === name)!;
    const meta = routerNode.meta ?? {};
    // 检查页签是否已存在（使用fullPath判断）
    const isExist = tabs.value.some((tab) => tab.value.fullPath === fullPath);

    if (!isExist) {
      tabs.value.push(
        computed(() => {
          return {
            path,
            fullPath,
            name: name as string,
            ...meta,
          };
        }),
      );
    }

    // 设置当前激活的页签
    activeTab.value = fullPath;
  };

  // 关闭页签
  const closeTab = (fullPath: string, router: any) => {
    // 不能关闭固定页签
    const targetTab = tabs.value.find((tab) => tab.value.fullPath === fullPath);
    if (targetTab?.value?.fixed) return;

    const tabIndex = tabs.value.findIndex((tab) => tab.value.fullPath === fullPath);

    if (tabIndex !== -1) {
      // 如果关闭的是当前激活的页签，需要激活其他页签
      if (fullPath === activeTab.value) {
        // 优先激活右侧页签，如果没有则激活左侧页签
        const nextTab = tabs.value[tabIndex + 1] || tabs.value[tabIndex - 1];
        if (nextTab) {
          router.push(nextTab.value.fullPath);
        }
      }

      // 移除页签
      tabs.value.splice(tabIndex, 1);
    }
  };

  // 关闭其他页签
  const closeOtherTabs = (fullPath: string) => {
    // 保留固定页签和当前页签
    tabs.value = tabs.value.filter((tab) => tab.value.fixed || tab.value.fullPath === fullPath);
    activeTab.value = fullPath;
  };

  // 关闭所有页签
  const closeAllTabs = (router: any) => {
    // 只保留固定页签
    const fixedTabs = tabs.value.filter((tab) => tab.value.fixed);
    tabs.value = fixedTabs;

    // 如果有固定页签，跳转到第一个固定页签
    if (fixedTabs.length > 0) {
      router.push(fixedTabs[0]?.value?.fullPath || '/');
    }
  };
  return reactive({
    tabs: readonly(tabs),
    activeTab: readonly(activeTab),
    addTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
  });
}

// 提供一个使用TabsStore的钩子函数
export function useTabsStore() {
  const store = inject(TabsStoreKey);

  if (!store) {
    throw new Error('useTabsStore must be used within a TabsStoreProvider');
  }

  return store;
}

// 提供一个Provider组件
export function provideTabsStore() {
  const store = createTabsStore();
  provide(TabsStoreKey, store);
  return store;
}
