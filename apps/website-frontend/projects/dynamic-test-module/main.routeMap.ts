/** ABOUTME: Dynamic test module route map */
import type { RouteNode } from '@tsfullstack/shared-frontend/utils'

export default {
  dynamicTestModule: {
    path: '/dynamic-test-module',
    component: () => import('./DynamicTestPage.vue'),
    meta: {
      title: '动态测试模块',
      icon: 'pi pi-bolt',
    },
  },
} satisfies Record<string, RouteNode>