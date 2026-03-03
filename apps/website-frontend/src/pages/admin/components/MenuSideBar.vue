<template>
  <div class="sidebar-container h-screen transition-all duration-300 ease-in-out relative shadow"
    :class="[isCollapsed ? 'w-20' : '']">
    <!-- 主侧边栏 -->
    <div
      class="h-full flex flex-col relative overflow-hidden transition-colors duration-300 bg-linear-to-b from-primary-50 via-primary-100 to-primary-200 dark:from-secondary-900 dark:via-secondary-800 dark:to-secondary-900 border-r border-primary-200 dark:border-secondary-700/50">
      <!-- 顶部Logo区域 -->
      <div class="logo-area border-b border-primary-200 dark:border-secondary-700/50"
        :class="[
          isCollapsed
            ? 'p-3 flex justify-center cursor-pointer hover:bg-primary-50 dark:hover:bg-secondary-800/50 transition-colors'
            : 'p-5 flex items-center justify-between'
        ]"
        @click="isCollapsed ? toggleCollapse() : null">
        <div class="flex items-center space-x-3">
          <div @click.stop="navigateToHome"
            class="logo-icon cursor-pointer flex items-center justify-center w-10 h-10 rounded-xl shadow-lg bg-linear-to-br from-info-500 to-info-400 dark:from-info-400 dark:to-info-600 shadow-info-200 dark:shadow-info-500/20">
            <i class="pi pi-bolt text-white text-xl"></i>
          </div>
          <h1
            class="font-bold text-xl tracking-wide transition-all duration-300 overflow-hidden whitespace-nowrap text-primary-800 dark:text-primary-50"
            :class="[isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto']">
            Ts<span class="text-primary-600 dark:text-info-400">FullStack</span>
          </h1>
        </div>
        <button v-if="!isCollapsed" @click.stop="toggleCollapse"
          class="p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-700 transition-colors text-primary-600 dark:text-primary-400"
          aria-label="Toggle menu">
          <i class="pi pi-bars"></i>
        </button>
      </div>

      <!-- 用户信息区域 -->
      <div class="user-profile px-4 py-5 flex items-center border-b border-primary-200 dark:border-secondary-700/50">
        <div class="relative">
          <a href="https://shenzilong.cn" target="_blank">
            <File2Url v-if="avatarUrl" :fileId="avatarUrl" v-slot="{ url }">
              <div class="w-12 h-12 rounded-full overflow-hidden shadow-lg border-2 border-primary-400 dark:border-info-400 mr-3">
                <img :src="url" alt="用户头像" class="w-full h-full object-cover" />
              </div>
            </File2Url>
            <div v-else class="w-12 h-12 rounded-full overflow-hidden shadow-lg border-2 border-primary-400 dark:border-info-400 mr-3">
              <img :src="avatarImageSrc" alt="默认头像" class="w-full h-full object-cover" />
            </div>
          </a>
          <span
            class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success-500 border-2 border-white dark:border-secondary-900 rounded-full"></span>
        </div>
        <div class="user-info transition-all duration-300 overflow-hidden whitespace-nowrap"
          :class="[isCollapsed ? 'opacity-0 w-0' : 'opacity-100 flex-1']">
          <h2 class="font-medium text-primary-800 dark:text-primary-50">{{ displayName }}</h2>
          <p class="text-sm text-primary-500 dark:text-secondary-400">{{ userProfile?.email || '未登录' }}</p>
        </div>
        <Badge v-if="!isCollapsed" value="3" variant="info" class="ml-auto"></Badge>
      </div>

      <!-- 搜索框 -->
      <div
        class="search-box px-4 py-3 transition-all duration-300 overflow-hidden border-b border-primary-200 dark:border-secondary-700/50"
        :class="[isCollapsed ? 'opacity-0 h-0 py-0' : 'opacity-100']">
        <span class="p-input-icon-left w-full">
          <Input v-model="searchQuery" placeholder="搜索..."
            class="w-full p-input-sm rounded-lg bg-primary-100 dark:bg-secondary-700/50 border-primary-300 dark:border-secondary-600 text-primary-800 dark:text-primary-50" />
        </span>
      </div>

      <!-- 菜单区域 -->
      <div class="menu-container flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
        <div v-if="isCollapsed" class="collapsed-menu">
          <ul class="flex flex-col items-center space-y-1">
            <li v-for="item in collapsedMenuItems" :key="item.key" class="w-full relative">
              <!-- 如果有子菜单，使用 Dropdown -->
              <Dropdown v-if="hasSubmenuItems(item)" v-model="dropdownOpenStates[item.key]" side="right" align="start" :sideOffset="4">
                <template #trigger>
                  <Button variant="icon" :icon="item.icon" :class="[
                      'w-full justify-center',
                      isActiveRoute(item)
                        ? 'text-primary-600 dark:text-info-400'
                        : '',
                      'has-submenu',
                    ]" :title="item.label" />
                </template>
                <div class="py-1">
                  <div v-for="subItem in getSubmenuItems(item)" :key="subItem.key" @click="navigateTo(subItem)"
                    class="flex items-center px-4 py-2 cursor-pointer transition-all duration-200 hover:bg-primary-100 dark:hover:bg-secondary-700/50 rounded"
                    :class="[
                      isActiveRoute(subItem)
                        ? 'bg-primary-50/70 dark:bg-linear-to-r dark:from-info-500/10 dark:to-info-500/5 text-primary-700 dark:text-primary-50'
                        : 'text-primary-600 dark:text-secondary-400',
                    ]">
                    <i :class="[
                        subItem.icon,
                        'mr-3 text-sm',
                        isActiveRoute(subItem) ? 'text-primary-600 dark:text-info-400' : '',
                      ]"></i>
                    <span class="flex-1 text-sm whitespace-nowrap">{{ subItem.label }}</span>
                    <Badge v-if="subItem.badge" :value="subItem.badge" :variant="getBadgeVariant(subItem)"></Badge>
                  </div>
                </div>
              </Dropdown>

              <!-- 如果没有子菜单，直接使用 Tooltip + Button -->
              <template v-else>
                <Tooltip :content="item.label" side="right">
                  <Button variant="icon" :icon="item.icon" :class="[
                      'w-full justify-center',
                      isActiveRoute(item)
                        ? 'text-primary-600 dark:text-info-400'
                        : '',
                    ]" @click="navigateTo(item)" />
                </Tooltip>
                <Badge v-if="item.badge" :value="item.badge" :variant="getBadgeVariant(item)"
                  class="absolute top-0 right-0 transform transecondary-x-1 -transecondary-y-1 scale-75"></Badge>
              </template>
            </li>
          </ul>
        </div>
        <div v-else class="expanded-menu">
          <div v-for="(category, index) in filteredMenuItems" :key="category.category" class="menu-category mb-4">
            <div
              class="menu-category-header flex items-center px-3 py-2 text-xs font-medium uppercase tracking-wider text-primary-500 dark:text-secondary-400"
              v-if="index > 0">
              {{ category.category }}
            </div>
            <div v-for="menuItem in category.items" :key="menuItem.key" class="menu-item relative">
              <div @click="toggleSubmenu(menuItem)"
                class="menu-item-header flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 mb-1"
                :class="[
                  isActiveRoute(menuItem)
                    ? 'bg-primary-50 dark:bg-linear-to-r dark:from-info-500/60 dark:to-info-500/30 text-primary-700 dark:text-primary-50'
                    : 'text-primary-700 hover:bg-primary-100 hover:text-primary-900 dark:text-secondary-300 dark:hover:bg-secondary-700/50 dark:hover:text-primary-50',
                ]">
                <i :class="[
                    menuItem.icon,
                    'mr-3 text-lg',
                    isActiveRoute(menuItem) ? 'text-primary-600 dark:text-info-400' : '',
                  ]"></i>
                <span class="flex-1">{{ menuItem.label }}</span>
                <Badge v-if="menuItem.badge" :value="menuItem.badge" :variant="getBadgeVariant(menuItem)" class="mr-2">
                </Badge>
                <i v-if="menuItem.items && menuItem.items.length" :class="[
                    menuItem.expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right',
                    'text-xs transition-transform duration-200',
                  ]"></i>
              </div>

              <!-- 子菜单 -->
              <div v-if="menuItem.items && menuItem.items.length"
                class="submenu pl-4 overflow-hidden transition-all duration-300 ease-in-out"
                :class="[menuItem.expanded ? 'max-h-96' : 'max-h-0']">
                <div v-for="subItem in menuItem.items" :key="subItem.key" @click="navigateTo(subItem)"
                  class="submenu-item flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 mb-1"
                  :class="[
                    isActiveRoute(subItem)
                      ? 'bg-primary-50/70 dark:bg-linear-to-r dark:from-info-500/10 dark:to-info-500/5 text-primary-700 dark:text-primary-50'
                      : 'text-primary-600 hover:bg-primary-100 hover:text-primary-800 dark:text-secondary-400 dark:hover:bg-secondary-700/30 dark:hover:text-primary-50',
                  ]">
                  <i :class="[
                      subItem.icon,
                      'mr-3 text-sm',
                      isActiveRoute(subItem) ? 'text-primary-600 dark:text-info-400' : '',
                    ]"></i>
                  <span class="flex-1 text-sm">{{ subItem.label }}</span>
                  <Badge v-if="subItem.badge" :value="subItem.badge" :variant="getBadgeVariant(subItem)"></Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作区 -->
      <div class="footer border-t border-primary-200 dark:border-secondary-700/50 p-4">
        <div class="flex items-center justify-around" :class="{ 'flex-col space-y-4': isCollapsed }">
          <ThemeSwitch />
          <I18nSwitch />
          <UserSettingBtn />
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
  import I18nSwitch from '@/components/system/I18nSwitch.vue';
  import ThemeSwitch from '@/components/system/ThemeToggle.vue';
  import { useComputedI18n } from '@/i18n';
  import { routeMap, router, routerUtil } from '@/router';
  import Badge from '@/components/base/Badge.vue';
  import Button from '@/components/base/Button.vue';
  import Input from '@/components/base/Input.vue';
  import File2Url from '@/pages/admin/components/File2Url.vue';
  import { Dropdown, Tooltip } from '@tsfullstack/shared-frontend/components';
  import { computed, reactive, ref } from 'vue';
  import type { RouteLocationRaw } from 'vue-router';
  import avatarImageSrc from '/崮生.png?url';
  import UserSettingBtn from '@/components/system/UserSettingBtn.vue';
  import { useUserProfile } from '@/composables/useUserProfile';

  /** 获取用户信息 */
  const { displayName, avatarUrl, userProfile } = useUserProfile();

  // 定义类型
  interface MenuItem {
    key: string;
    label: string;
    icon: string;
    to?: string | RouteLocationRaw;
    badge?: string;
    badgeVariant?: string;
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

  // 存储 Dropdown 打开状态的响应式对象
  const dropdownOpenStates = reactive<Record<string, boolean>>({});

  // 跳转到首页
  const navigateToHome = (): void => {
    router.push(routerUtil.to(routeMap.index, {}));
  };

  // 切换折叠状态
  const toggleCollapse = (): void => {
    isCollapsed.value = !isCollapsed.value;
  };

  const t = useComputedI18n();

  const menuItems = reactive([
    {
      category: t('工作台'),
      items: [
        {
          key: 'dashboard',
          label: t('控制台'),
          icon: 'pi pi-home',
          to: routerUtil.to(routeMap.admin.child.index, {}),
        },
        {
          key: 'studio',
          label: t('模型管理'),
          icon: 'pi pi-th-large',
          to: routerUtil.to(routeMap.admin.child.studio, {}),
          badgeVariant: 'info',
          expanded: false,
        },
        {
          key: 'UploadList',
          label: t('上传列表'),
          icon: 'pi pi-upload',
          to: routerUtil.to(routeMap.admin.child.UploadList, {}),
          badgeVariant: 'info',
          expanded: false,
        },
        {
          key: 'ShareList',
          label: t('分享管理'),
          icon: routeMap.admin.child.ShareList.meta.icon,
          to: routerUtil.to(routeMap.admin.child.ShareList, {}),
        },
        {
          key: 'resourceGallery',
          label: t('资源库'),
          icon: routeMap.admin.child.resourceGallery.meta.icon,
          to: routerUtil.to(routeMap.admin.child.resourceGallery, {}),
        },
        {
          key: 'aiManagement',
          label: t('AI工作台'),
          icon: 'pi pi-android',
          expanded: false,
          items: [
            {
              key: 'aiImageGeneration',
              label: t('AI图片生成'),
              icon: routeMap.admin.child.aiImageGeneration.meta.icon,
              to: routerUtil.to(routeMap.admin.child.aiImageGeneration, {}),
            },
            {
              key: 'aiModelManager',
              label: t('AI模型管理'),
              icon: 'pi pi-microchip-ai',
              to: '/admin/aiModelManager',
            },
          ],
        },
        {
          key: 'tokenManagement',
          label: t('代币管理'),
          icon: 'pi pi-bitcoin',
          expanded: false,
          items: [
            {
              key: 'tokenPackageManagement',
              label: t('代币套餐管理'),
              icon: routeMap.admin.child.tokenPackageManagement.meta.icon,
              to: routerUtil.to(routeMap.admin.child.tokenPackageManagement, {}),
            },
            {
              key: 'userTokenManagement',
              label: t('用户代币管理'),
              icon: routeMap.admin.child.userTokenManagement.meta.icon,
              to: routerUtil.to(routeMap.admin.child.userTokenManagement, {}),
            },
            {
              key: 'userSubscriptionManagement',
              label: t('用户订阅管理'),
              icon: routeMap.admin.child.userSubscriptionManagement.meta.icon,
              to: routerUtil.to(routeMap.admin.child.userSubscriptionManagement, {}),
            },
          ],
        },
      ],
    },
    {
      category: t('用户与权限'),
      items: [
        {
          key: 'users',
          label: t('用户管理'),
          icon: 'pi pi-users',
          expanded: false,
          items: [
            {
              key: 'user-list',
              label: t('用户列表'),
              icon: 'pi pi-list',
              to: routerUtil.to(
                routeMap.admin.child.studio,
                {},
                { hideSwitch: 'true', modelName: 'User' },
              ),
            },
          ],
        },
        {
          key: 'roles',
          label: t('角色权限'),
          icon: 'pi pi-shield',
          to: routerUtil.to(
            routeMap.admin.child.studio,
            {},
            { hideSwitch: 'true', modelName: 'Role' },
          ),
        },
      ],
    },
    {
      category: t('系统设置'),
      items: [
        {
          key: 'userSettings',
          label: t('个人设置'),
          icon: routeMap.admin.child.userSettings.meta.icon,
          to: routerUtil.to(routeMap.admin.child.userSettings, {}),
        },
        {
          key: 'settings',
          label: t('系统设置'),
          icon: 'pi pi-cog',
          expanded: false,
          items: [],
        },
        {
          key: 'logs',
          label: t('系统日志'),
          icon: 'pi pi-list',
          to: routerUtil.to(routeMap.admin.child.systemLog, {}),
        },
      ],
    },
  ]) as MenuCategory[];

  // 折叠状态下的菜单项（只显示顶级菜单）
  const collapsedMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [];
    menuItems.forEach((category) => {
      category.items.forEach((item) => {
        items.push({
          key: item.key,
          label: item.label,
          icon: item.icon,
          to: item.to || (item.items && item.items.length > 0 ? item.items[0]?.to : undefined),
          badge: item.badge,
          badgeVariant: item.badgeVariant,
          items: item.items, // 保留子菜单项
        });
      });
    });
    return items;
  });

  // 过滤菜单项
  const filteredMenuItems = computed<MenuCategory[]>(() => {
    if (!searchQuery.value) return menuItems;

    const result: MenuCategory[] = [];

    menuItems.forEach((category) => {
      const filteredItems = category.items.filter((item) => {
        const matchesSearch = item.label.toLowerCase().includes(searchQuery.value.toLowerCase());

        if (item.items) {
          const filteredSubItems = item.items.filter((subItem) =>
            subItem.label.toLowerCase().includes(searchQuery.value.toLowerCase()),
          );

          if (filteredSubItems.length > 0) {
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
    router.push(item.to);
  };

  // 检查是否是当前活动路由
  const isActiveRoute = (item: MenuItem): boolean => {
    // 实际项目中应该使用 router.currentRoute.value.path === item.to
    return item.to === '/admin/dashboard';
  };

  // 获取徽章样式
  const getBadgeVariant = (item: MenuItem): string => {
    return item.badgeVariant || 'info';
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
  background-color: rgba(71, 85, 105, 0.3);
  border-radius: 20px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(71, 85, 105, 0.5);
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
  background: radial-gradient(circle,
      rgba(59, 130, 246, 0.7) 0%,
      rgba(37, 99, 235, 0.5) 50%,
      transparent 70%);
  top: 10%;
  left: -150px;
  animation: float 15s ease-in-out infinite alternate;
}

.glow-2 {
  width: 250px;
  height: 250px;
  background: radial-gradient(circle,
      rgba(37, 99, 235, 0.7) 0%,
      rgba(59, 130, 246, 0.5) 50%,
      transparent 70%);
  bottom: 10%;
  right: -100px;
  animation: float 20s ease-in-out infinite alternate-reverse;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(to right, rgba(71, 85, 105, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(71, 85, 105, 0.05) 1px, transparent 1px);
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
  background: linear-gradient(to bottom right,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0) 40%,
      rgba(255, 255, 255, 0.4) 50%,
      rgba(255, 255, 255, 0) 60%,
      rgba(255, 255, 255, 0) 100%);
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
