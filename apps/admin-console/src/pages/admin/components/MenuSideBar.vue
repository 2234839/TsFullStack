<template>
  <div
    class="sidebar-container h-screen transition-all duration-300 ease-in-out relative shadow"
    :class="[isCollapsed ? 'w-20' : '']">
    <!-- 主侧边栏 -->
    <div
      class="h-full flex flex-col relative overflow-hidden transition-colors duration-300 bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-r border-gray-200 dark:border-slate-700/50">
      <!-- 顶部Logo区域 -->
      <div
        class="logo-area p-5 flex items-center justify-between border-b border-gray-200 dark:border-slate-700/50">
        <div class="flex items-center space-x-3">
          <div
            @click="toggleCollapse"
            class="logo-icon cursor-pointer flex items-center justify-center w-10 h-10 rounded-xl shadow-lg bg-gradient-to-br from-blue-500 to-cyan-400 dark:from-cyan-400 dark:to-blue-600 shadow-blue-200 dark:shadow-blue-500/20">
            <i class="pi pi-bolt text-white text-xl"></i>
          </div>
          <h1
            class="font-bold text-xl tracking-wide transition-all duration-300 overflow-hidden whitespace-nowrap text-gray-800 dark:text-white"
            :class="[isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto']">
            Ts<span class="text-blue-500 dark:text-cyan-400">FullStack</span>
          </h1>
        </div>
        <Button
          @click="toggleCollapse"
          icon="pi pi-bars"
          class="p-button-rounded p-button-text p-button-plain"
          aria-label="Toggle menu" />
      </div>

      <!-- 用户信息区域 -->
      <div
        class="user-profile px-4 py-5 flex items-center border-b border-gray-200 dark:border-slate-700/50">
        <div class="relative">
          <a href="https://shenzilong.cn" target="_blank">
            <Avatar
              :image="avatarImageSrc"
              class="mr-3 shadow-lg border-2 border-blue-400 dark:border-cyan-400"
              size="large"
              shape="circle" />
          </a>
          <span
            class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></span>
        </div>
        <div
          class="user-info transition-all duration-300 overflow-hidden whitespace-nowrap"
          :class="[isCollapsed ? 'opacity-0 w-0' : 'opacity-100 flex-1']">
          <h2 class="font-medium text-gray-800 dark:text-white">Alex Johnson</h2>
          <p class="text-sm text-gray-500 dark:text-slate-400">系统管理员</p>
        </div>
        <Badge v-if="!isCollapsed" value="3" severity="info" class="ml-auto"></Badge>
      </div>

      <!-- 搜索框 -->
      <div
        class="search-box px-4 py-3 transition-all duration-300 overflow-hidden border-b border-gray-200 dark:border-slate-700/50"
        :class="[isCollapsed ? 'opacity-0 h-0 py-0' : 'opacity-100']">
        <span class="p-input-icon-left w-full">
          <InputText
            v-model="searchQuery"
            placeholder="搜索..."
            class="w-full p-input-sm rounded-lg bg-gray-100 dark:bg-slate-700/50 border-gray-300 dark:border-slate-600 text-gray-800 dark:text-white" />
        </span>
      </div>

      <!-- 菜单区域 -->
      <div class="menu-container flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
        <div v-if="isCollapsed" class="collapsed-menu">
          <ul class="flex flex-col items-center space-y-1">
            <li v-for="item in collapsedMenuItems" :key="item.key" class="w-full relative">
              <Button
                :icon="item.icon"
                :class="[
                  'p-button-rounded p-button-text w-full justify-center',
                  isActiveRoute(item)
                    ? 'p-button-outlined text-blue-600 dark:text-cyan-400'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white',
                  hasSubmenuItems(item) ? 'has-submenu' : '',
                ]"
                v-tooltip.right="item.label"
                @click="handleCollapsedMenuClick($event, item)" />
              <Badge
                v-if="item.badge"
                :value="item.badge"
                :severity="getBadgeSeverity(item)"
                class="absolute top-0 right-0 transform translate-x-1 -translate-y-1 scale-75"></Badge>

              <!-- 使用PrimeVue的Popover -->
              <Popover
                :ref="(el) => setPopoverRef(item.key, el)"
                :showCloseIcon="false"
                class="p-popover-submenu">
                <div class="py-1">
                  <div
                    v-for="subItem in getSubmenuItems(item)"
                    :key="subItem.key"
                    @click="navigateTo(subItem)"
                    class="p-popover-item flex items-center px-4 py-2 cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-slate-700/50"
                    :class="[
                      isActiveRoute(subItem)
                        ? 'bg-blue-50/70 dark:bg-gradient-to-r dark:from-cyan-500/10 dark:to-blue-500/5 text-blue-700 dark:text-white'
                        : 'text-gray-600 dark:text-slate-400',
                    ]">
                    <i
                      :class="[
                        subItem.icon,
                        'mr-3 text-sm',
                        isActiveRoute(subItem) ? 'text-blue-600 dark:text-cyan-400' : '',
                      ]"></i>
                    <span class="flex-1 text-sm whitespace-nowrap">{{ subItem.label }}</span>
                    <Badge
                      v-if="subItem.badge"
                      :value="subItem.badge"
                      :severity="getBadgeSeverity(subItem)"></Badge>
                  </div>
                </div>
              </Popover>
            </li>
          </ul>
        </div>
        <div v-else class="expanded-menu">
          <div
            v-for="(category, index) in filteredMenuItems"
            :key="category.category"
            class="menu-category mb-4">
            <div
              class="menu-category-header flex items-center px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400"
              v-if="index > 0">
              {{ category.category }}
            </div>
            <div v-for="menuItem in category.items" :key="menuItem.key" class="menu-item relative">
              <div
                @click="toggleSubmenu(menuItem)"
                class="menu-item-header flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 mb-1"
                :class="[
                  isActiveRoute(menuItem)
                    ? 'bg-blue-50 dark:bg-gradient-to-r dark:from-cyan-500/60 dark:to-blue-500/30 text-blue-700 dark:text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-white',
                ]">
                <i
                  :class="[
                    menuItem.icon,
                    'mr-3 text-lg',
                    isActiveRoute(menuItem) ? 'text-blue-600 dark:text-cyan-400' : '',
                  ]"></i>
                <span class="flex-1">{{ menuItem.label }}</span>
                <Badge
                  v-if="menuItem.badge"
                  :value="menuItem.badge"
                  :severity="getBadgeSeverity(menuItem)"
                  class="mr-2"></Badge>
                <i
                  v-if="menuItem.items && menuItem.items.length"
                  :class="[
                    menuItem.expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right',
                    'text-xs transition-transform duration-200',
                  ]"></i>
              </div>

              <!-- 子菜单 -->
              <div
                v-if="menuItem.items && menuItem.items.length"
                class="submenu pl-4 overflow-hidden transition-all duration-300 ease-in-out"
                :class="[menuItem.expanded ? 'max-h-96' : 'max-h-0']">
                <div
                  v-for="subItem in menuItem.items"
                  :key="subItem.key"
                  @click="navigateTo(subItem)"
                  class="submenu-item flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 mb-1"
                  :class="[
                    isActiveRoute(subItem)
                      ? 'bg-blue-50/70 dark:bg-gradient-to-r dark:from-cyan-500/10 dark:to-blue-500/5 text-blue-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-700/30 dark:hover:text-white',
                  ]">
                  <i
                    :class="[
                      subItem.icon,
                      'mr-3 text-sm',
                      isActiveRoute(subItem) ? 'text-blue-600 dark:text-cyan-400' : '',
                    ]"></i>
                  <span class="flex-1 text-sm">{{ subItem.label }}</span>
                  <Badge
                    v-if="subItem.badge"
                    :value="subItem.badge"
                    :severity="getBadgeSeverity(subItem)"></Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作区 -->
      <div class="footer border-t border-gray-200 dark:border-slate-700/50 p-4">
        <div
          class="flex items-center justify-around"
          :class="{ 'flex-col space-y-4': isCollapsed }">
          <Button
            icon="pi pi-cog"
            class="p-button-rounded p-button-text p-button-plain"
            v-tooltip.right="'设置'" />
          <ThemeSwitch v-tooltip.right="'主题切换'" />
          <I18nSwitch />
          <Button
            icon="pi pi-power-off"
            class="p-button-rounded p-button-text p-button-plain"
            @click="authInfo_logout()"
            v-tooltip.right="'退出'" />
        </div>
      </div>

      <!-- 装饰元素 -->
      <div class="decorative-elements pointer-events-none">
        <div class="glow-effect glow-1"></div>
        <div class="glow-effect glow-2"></div>
        <div class="grid-overlay"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import ThemeSwitch from '@/components/system/ThemeToggle.vue';
  import { authInfo_logout } from '@/storage';
  import { Popover, InputText, Button, Badge, Avatar, Menu } from 'primevue';
  import { computed, ref } from 'vue';
  import avatarImageSrc from '/崮生.png?url';
  import I18nSwitch from '@/components/system/I18nSwitch.vue';
  import { routeMap, router, routerUtil } from '@/router';
  import type { RouteLocationRaw } from 'vue-router';

  // 定义类型
  interface MenuItem {
    key: string;
    label: string;
    icon: string;
    to?: string | RouteLocationRaw;
    badge?: string;
    badgeSeverity?: string;
    expanded?: boolean;
    items?: MenuItem[];
  }

  interface MenuCategory {
    category: string;
    items: MenuItem[];
  }

  // 侧边栏状态
  const isCollapsed = ref(false);
  const searchQuery = ref('');

  // 存储Popover引用的Map
  const popovers = ref<Map<string, any>>(new Map());

  // 设置Popover引用
  const setPopoverRef = (key: string, el: any) => {
    if (el) {
      popovers.value.set(key, el);
    }
  };

  // 切换折叠状态
  const toggleCollapse = (): void => {
    isCollapsed.value = !isCollapsed.value;
  };

  // 菜单数据结构
  const menuItems = ref<MenuCategory[]>([
    {
      category: '主导航',
      items: [
        {
          key: 'studio',
          label: '仪表盘',
          icon: 'pi pi-th-large',
          to: routerUtil.to(routeMap.admin.child.studio, {}),
          badgeSeverity: 'info',
          expanded: false,
        },
      ],
    },

    {
      category: '用户与权限',
      items: [
        {
          key: 'users',
          label: '用户管理',
          icon: 'pi pi-users',
          expanded: false,
          items: [
            {
              key: 'user-list',
              label: '用户列表',
              icon: 'pi pi-list',
              to: '/admin/users',
            },
            {
              key: 'user-groups',
              label: '用户组',
              icon: 'pi pi-sitemap',
              to: '/admin/user-groups',
            },
          ],
        },
        {
          key: 'roles',
          label: '角色权限',
          icon: 'pi pi-shield',
          to: '/admin/roles',
        },
      ],
    },
    {
      category: '电子商务',
      items: [
        {
          key: 'products',
          label: '产品管理',
          icon: 'pi pi-shopping-bag',
          expanded: false,
          items: [
            {
              key: 'product-list',
              label: '产品列表',
              icon: 'pi pi-list',
              to: '/admin/products',
            },
            {
              key: 'product-categories',
              label: '产品分类',
              icon: 'pi pi-tags',
              to: '/admin/product-categories',
            },
            {
              key: 'inventory',
              label: '库存管理',
              icon: 'pi pi-box',
              to: '/admin/inventory',
            },
          ],
        },
        {
          key: 'orders',
          label: '订单管理',
          icon: 'pi pi-shopping-cart',
          badge: '25',
          badgeSeverity: 'warning',
          expanded: false,
          items: [
            {
              key: 'order-list',
              label: '订单列表',
              icon: 'pi pi-list',
              to: '/admin/orders',
            },
            {
              key: 'shipments',
              label: '发货管理',
              icon: 'pi pi-send',
              to: '/admin/shipments',
            },
          ],
        },
      ],
    },
    {
      category: '系统设置',
      items: [
        {
          key: 'settings',
          label: '系统设置',
          icon: 'pi pi-cog',
          expanded: false,
          items: [
            {
              key: 'general',
              label: '常规设置',
              icon: 'pi pi-sliders-h',
              to: '/admin/settings/general',
            },
            {
              key: 'appearance',
              label: '外观设置',
              icon: 'pi pi-palette',
              to: '/admin/settings/appearance',
            },
            {
              key: 'security',
              label: '安全设置',
              icon: 'pi pi-lock',
              to: '/admin/settings/security',
            },
          ],
        },
        {
          key: 'logs',
          label: '系统日志',
          icon: 'pi pi-list',
          to: '/admin/logs',
        },
      ],
    },
  ]);

  // 折叠状态下的菜单项（只显示顶级菜单）
  const collapsedMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [];
    menuItems.value.forEach((category) => {
      category.items.forEach((item) => {
        items.push({
          key: item.key,
          label: item.label,
          icon: item.icon,
          to: item.to || (item.items && item.items.length > 0 ? item.items[0].to : undefined),
          badge: item.badge,
          badgeSeverity: item.badgeSeverity,
          items: item.items, // 保留子菜单项
        });
      });
    });
    return items;
  });

  // 过滤菜单项
  const filteredMenuItems = computed<MenuCategory[]>(() => {
    if (!searchQuery.value) return menuItems.value;

    const result: MenuCategory[] = [];

    menuItems.value.forEach((category) => {
      const filteredItems = category.items.filter((item) => {
        const matchesSearch = item.label.toLowerCase().includes(searchQuery.value.toLowerCase());

        if (item.items) {
          const filteredSubItems = item.items.filter((subItem) =>
            subItem.label.toLowerCase().includes(searchQuery.value.toLowerCase()),
          );

          if (filteredSubItems.length > 0) {
            // 创建一个新对象，避免修改原始数据
            item = { ...item, items: filteredSubItems };
            return true;
          }
        }

        return matchesSearch;
      });

      if (filteredItems.length > 0) {
        result.push({
          category: category.category,
          items: filteredItems,
        });
      }
    });

    return result;
  });

  // 切换子菜单展开/折叠
  const toggleSubmenu = (item: MenuItem): void => {
    if (item.items && item.items.length) {
      item.expanded = !item.expanded;
    } else {
      navigateTo(item);
    }
  };

  // 处理折叠菜单点击
  const handleCollapsedMenuClick = (event: Event, item: MenuItem): void => {
    if (hasSubmenuItems(item)) {
      // 如果有子菜单，显示Popover
      const panel = popovers.value.get(item.key);
      if (panel) {
        panel.toggle(event);
      }
    } else {
      // 如果没有子菜单，直接导航
      navigateTo(item);
    }
  };

  // 检查是否有子菜单项
  const hasSubmenuItems = (item: MenuItem): boolean => {
    return !!(item.items && item.items.length);
  };

  // 获取子菜单项
  const getSubmenuItems = (item: MenuItem): MenuItem[] => {
    return item.items || [];
  };

  const navigateTo = (item: MenuItem): void => {
    if (!item.to) {
      return;
    }
    console.log('[item]',item);
    router.push(item.to);

    // 关闭所有打开的Popover
    popovers.value.forEach((panel) => {
      if (panel.visible) {
        panel.hide();
      }
    });
  };

  // 检查是否是当前活动路由
  const isActiveRoute = (item: MenuItem): boolean => {
    // 实际项目中应该使用 router.currentRoute.value.path === item.to
    return item.to === '/admin/dashboard';
  };

  // 获取徽章样式
  const getBadgeSeverity = (item: MenuItem): string => {
    return item.badgeSeverity || 'info';
  };
</script>

<style scoped>
  /* 基础样式 */
  .sidebar-container {
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 50;
  }

  /* 自定义滚动条 */
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(100, 116, 139, 0.3);
    border-radius: 20px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(100, 116, 139, 0.5);
  }

  /* 有子菜单的菜单项样式 */
  .has-submenu::after {
    content: '';
    position: absolute;
    top: 65%;
    right: 0px;
    transform: translateY(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: currentColor;
    opacity: 0.5;
  }

  /* 子菜单项样式 */
  .p-popover-item {
    transition: background-color 0.2s ease;
  }

  /* 自定义Popover样式 */
  :deep(.p-popover-submenu) {
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(229, 231, 235, 1);
    padding: 0;
    min-width: 200px;
  }

  :deep(.dark .p-popover-submenu) {
    background-color: rgb(30, 41, 59);
    border-color: rgba(51, 65, 85, 0.5);
  }

  /* 装饰元素 */
  .decorative-elements {
    position: absolute;
    inset: 0;
    overflow: hidden;
    z-index: -1;
  }

  .glow-effect {
    position: absolute;
    border-radius: 50%;
    filter: blur(70px);
    opacity: 0.07;
  }

  .glow-1 {
    width: 300px;
    height: 300px;
    background: radial-gradient(
      circle,
      rgba(59, 130, 246, 0.7) 0%,
      rgba(37, 99, 235, 0.5) 50%,
      transparent 70%
    );
    top: 10%;
    left: -150px;
    animation: float 15s ease-in-out infinite alternate;
  }

  .glow-2 {
    width: 250px;
    height: 250px;
    background: radial-gradient(
      circle,
      rgba(37, 99, 235, 0.7) 0%,
      rgba(59, 130, 246, 0.5) 50%,
      transparent 70%
    );
    bottom: 10%;
    right: -100px;
    animation: float 20s ease-in-out infinite alternate-reverse;
  }

  .grid-overlay {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(to right, rgba(100, 116, 139, 0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(100, 116, 139, 0.05) 1px, transparent 1px);
    background-size: 20px 20px;
    opacity: 0.3;
  }

  /* 动画 */
  @keyframes float {
    0% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-30px) rotate(5deg);
    }
    100% {
      transform: translateY(0) rotate(0deg);
    }
  }

  /* 菜单项动画 */
  .menu-item-header,
  .submenu-item {
    position: relative;
    overflow: hidden;
  }

  .menu-item-header::before,
  .submenu-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 0;
    background: linear-gradient(90deg, rgba(59, 130, 246, 0.1), transparent);
    transition: width 0.3s ease;
  }

  .menu-item-header:hover::before,
  .submenu-item:hover::before {
    width: 100%;
  }

  /* Logo动画 */
  .logo-icon {
    position: relative;
    overflow: hidden;
  }

  .logo-icon::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      to bottom right,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0) 40%,
      rgba(255, 255, 255, 0.4) 50%,
      rgba(255, 255, 255, 0) 60%,
      rgba(255, 255, 255, 0) 100%
    );
    transform: rotate(45deg);
    animation: shine 3s infinite;
  }

  @keyframes shine {
    0% {
      transform: rotate(45deg) translateX(-100%);
    }
    20%,
    100% {
      transform: rotate(45deg) translateX(100%);
    }
  }

  /* 响应式调整 */
  @media (max-width: 768px) {
    .sidebar-container {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 100;
      transform: translateX(0);
      transition: transform 0.3s ease;
    }

    .sidebar-container.collapsed {
      transform: translateX(-100%);
    }
  }
</style>
