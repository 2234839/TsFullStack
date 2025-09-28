// ABOUTME: Module Template 路由配置文件
// 定义了模块的所有路由，会被 module-autoload 自动发现并导出

import { type RouteNode, type RouteTree } from '@tsfullstack/shared-frontend/utils';

export default {
  // 模块主路由
  'module-template': {
    path: '/module-template',
    component: () => import('./pages/DemoPage.vue'),
    meta: {
      title: 'Module Template',
      icon: 'pi pi-cube',
      hidden: false,
      keepAlive: true,
    } as RouteNode['meta'],
    child: {
      subpage1: {
        path: 'subpage1',
        component: () => import('./pages/SubPage1.vue'),
        meta: {
          title: '子页面 1',
          icon: 'pi pi-file',
          hidden: false,
        } as RouteNode['meta'],
      },
      subpage2: {
        path: 'subpage2',
        component: () => import('./pages/SubPage2.vue'),
        meta: {
          title: '子页面 2',
          icon: 'pi pi-table',
          hidden: false,
        } as RouteNode['meta'],
      },
      settings: {
        path: 'settings',
        component: () => import('./pages/SettingsPage.vue'),
        meta: {
          title: '设置页面',
          icon: 'pi pi-cog',
          hidden: false,
        } as RouteNode['meta'],
      },
    },
  },
} as const satisfies RouteTree;
