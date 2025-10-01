import type { RouteNode } from '../../src/router'

export default {
  autoRouteTest: {
    path: '/auto-route-test',
    component: () => import('./TestPage.vue'),
    meta: {
      title: '自动路由测试',
      icon: 'pi pi-sparkles',
    },
  },
} satisfies Record<string, RouteNode>