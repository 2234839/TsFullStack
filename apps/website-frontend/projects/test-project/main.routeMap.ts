/** ABOUTME: Test project main route map */
import type { RouteNode } from '@tsfullstack/shared-frontend/utils'

export default {
  testMain: {
    path: '/test-main',
    component: () => import('./TestMainPage.vue'),
    meta: {
      title: '测试项目主页',
      icon: 'pi pi-home',
    },
  },
  testAbout: {
    path: '/test-about',
    component: () => import('./TestAboutPage.vue'),
    meta: {
      title: '测试项目关于',
      icon: 'pi pi-info-circle',
    },
  },
} satisfies Record<string, RouteNode>