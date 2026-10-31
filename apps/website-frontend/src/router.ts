import { createRouter, createWebHistory, type RouteLocationRaw, type RouteRecordRaw, type Router } from 'vue-router';
import { t as i18n_t } from './i18n';
import { computed, reactive } from 'vue';
import {
  buildNestedTree,
  transformRoutes,
  getTargetRouter,
  type RouteNode,
  type RouteTree,
} from '@tsfullstack/shared-frontend/utils';
import { routeModels } from './routes';
/** path 为 "" 的子路由会自动渲染在父路由中 */
export const defaultRoute = '';

const t = (key: string) => computed(() => i18n_t(key));

const routeModelTree = buildNestedTree(routeModels);

export const routeMap = reactive({
  ...routeModelTree,
  index: {
    path: '/',
    component: () => import('@/pages/index.vue'),
    meta: {
      title: t('首页'),
      hidden: true,
    },
  },
  admin: {
    path: '/admin',
    component: () => import('@/pages/admin/AdminLayout.vue'),
    meta: {
      title: t('管理后台'),
      icon: 'pi pi-cog',
    },
    child: {
      index: {
        path: '',
        component: () => import('@/pages/admin/DataBaseStudio.vue'),
        meta: {
          title: t('仪表盘'),
          icon: 'pi pi-home',
        },
      },
      studio: {
        path: 'studio',
        meta: {
          title: t('数据工作室'),
          icon: 'pi pi-desktop',
          keepAlive: true,
        },
        component: () => import('@/pages/admin/DataBaseStudio.vue'),
      },
      systemLog: {
        path: 'systemLog',
        component: () => import('@/pages/admin/BehaviorLog.vue'),
        meta: {
          title: t('行为记录'),
          icon: 'pi pi-history',
        },
      },
      diagTrace: {
        path: 'diagTrace',
        component: () => import('@/pages/admin/DiagTrace.vue'),
        meta: {
          title: t('慢请求诊断'),
          icon: 'pi pi-chart-line',
        },
      },
      UploadList: {
        path: 'UploadList',
        component: () => import('@/pages/admin/UploadList.vue'),
        meta: {
          title: t('上传列表'),
          icon: 'pi pi-upload',
        },
      },
      ShareList: {
        path: 'ShareList',
        component: () => import('@/pages/admin/share/ShareList.vue'),
        meta: {
          title: t('分享列表'),
          icon: 'pi pi-share-alt',
        },
      },
      groupEntry: {
        path: 'groupEntry',
        component: () => import('@/pages/admin/GroupEntryManagement.vue'),
        meta: {
          title: t('私域引流'),
          icon: 'pi pi-qrcode',
        },
      },
      channelMessages: {
        path: 'channelMessages',
        component: () => import('@/pages/admin/ChannelMessages.vue'),
        meta: {
          title: t('渠道消息'),
          icon: 'pi pi-comments',
        },
      },
      aiModelManager: {
        path: 'aiModelManager',
        component: () => import('@/pages/admin/AiModelManager.vue'),
        meta: {
          title: t('AI模型管理'),
          icon: 'pi pi-microchip-ai',
        },
      },
      aiImageGeneration: {
        path: 'aiImageGeneration',
        component: () => import('@/pages/admin/AIImageGeneration.vue'),
        meta: {
          title: t('AI图片生成'),
          icon: 'pi pi-sparkles',
        },
      },
      tokenPackageManagement: {
        path: 'tokenPackageManagement',
        component: () => import('@/pages/admin/TokenPackageManagement.vue'),
        meta: {
          title: t('代币套餐管理'),
          icon: 'pi pi-box',
        },
      },
      userTokenManagement: {
        path: 'userTokenManagement',
        component: () => import('@/pages/admin/UserTokenManagement.vue'),
        meta: {
          title: t('用户代币管理'),
          icon: 'pi pi-users',
        },
      },
      userSubscriptionManagement: {
        path: 'userSubscriptionManagement',
        component: () => import('@/pages/admin/UserSubscriptionManagement.vue'),
        meta: {
          title: t('用户订阅管理'),
          icon: 'pi pi-bookmark',
        },
      },
      resourceGallery: {
        path: 'resourceGallery',
        component: () => import('@/pages/admin/ResourceGallery.vue'),
        meta: {
          title: t('资源库'),
          icon: 'pi pi-images',
        },
      },
      userSettings: {
        path: 'userSettings',
        component: () => import('@/pages/admin/UserSettings.vue'),
        meta: {
          title: t('个人设置'),
          icon: 'pi pi-user-edit',
        },
      },
      paymentConfig: {
        path: 'paymentConfig',
        component: () => import('@/pages/admin/PaymentConfig.vue'),
        meta: {
          title: t('支付配置'),
          icon: 'pi pi-wallet',
        },
      },
      paymentOrderList: {
        path: 'paymentOrderList',
        component: () => import('@/pages/admin/PaymentOrderList.vue'),
        meta: {
          title: t('支付订单'),
          icon: 'pi pi-list',
        },
      },
    },
  },
  ShareDetail: {
    path: '/ShareDetail/:id',
    component: () => import('@/pages/share/ShareEditor.vue'),
    meta: {
      title: t('分享详情'),
      icon: 'pi pi-share',
    },
  },
  treehole: {
    path: '/treehole',
    component: () => import('@/pages/treehole/Treehole.vue'),
    meta: {
      title: t('树洞'),
      icon: 'pi pi-comments',
    },
  },
  pricing: {
    path: '/pricing',
    component: () => import('@/pages/pricing/PricingPage.vue'),
    meta: {
      title: t('购买套餐'),
      icon: 'pi pi-shopping-cart',
    },
  },
  noteCalc: {
    path: '/noteCalc',
    component: () => import('@/pages/noteCalc/NoteCalc.vue'),
    meta: {
      title: t('计算笔记'),
      icon: 'pi pi-calculator',
    },
  },
  noteCalcEmbed: {
    path: '/noteCalc/embed',
    component: () => import('@/pages/noteCalc/NoteCalcEmbed.vue'),
    meta: {
      title: 'NoteCalc Embed',
      hideTab: true,
      bare: true,
    },
  },
  oauth: {
    path: '/oauth',
    redirect: defaultRoute,
    child: {
      github: {
        path: 'github',
        component: () => import('@/pages/oauth/github.vue'),
        meta: {
          title: t('GitHub授权'),
          icon: 'pi pi-github',
        },
      },
      linuxdo: {
        path: 'linuxdo',
        component: () => import('@/pages/oauth/linuxdo.vue'),
        meta: {
          title: t('LINUX DO授权'),
          icon: 'pi pi-globe',
        },
      },
    },
  },
  AiEnglish: {
    path: '/AiEnglish',
    redirect: defaultRoute,
    child: {
      index: {
        path: defaultRoute,
        component: () => import('@/pages/AiEnglish/AiEnglish.vue'),
        meta: {
          title: t('AI英语学习'),
          icon: 'pi pi-book',
        },
      },
    },
  },
  tests: {
    path: '/tests',
    redirect: '/',
  },
  componentShowcase: {
    path: '/components',
    component: () => import('@/pages/components/ComponentShowcase.vue'),
    meta: {
      title: t('组件展示'),
      icon: 'pi pi-palette',
      hideTab: true,
    },
  },
  visualTest: {
    path: '/visual-test',
    component: () => import('@/pages/visual-test/VisualTestApproval.vue'),
    meta: {
      title: t('视觉回归测试'),
      icon: 'pi pi-images',
      hideTab: true,
    },
  },
  util: {
    path: '/util',
    redirect: defaultRoute,
    child: {
      Img2Svg: {
        path: 'Img2Svg',
        component: () => import('@/pages/util/Img2Svg.vue'),
        meta: {
          title: t('图片转SVG'),
          icon: 'pi pi-image',
        },
      },
    },
  },
  login: {
    path: '/login',
    component: () => import('@/pages/login.vue'),
    meta: {
      title: t('登录'),
      hideTab: true,
    },
  },
  account: {
    path: '/account',
    component: () => import('@/pages/account/AccountSettings.vue'),
    meta: {
      title: t('账号设置'),
      hideTab: true,
    },
  },
  redirect: {
    path: '/redirect',
    component: () => import('@/pages/Redirect.vue'),
    meta: {
      title: t('重定向'),
      hideTab: true,
    },
  },
  notFound: {
    path: '/:pathMatch(.*)*',
    component: () => import('@/pages/NotFound.vue'),
    meta: {
      title: t('页面不存在'),
      hideTab: true,
    },
  },
}) satisfies RouteTree;

export const allRoutes: RouteNode[] = transformRoutes(routeMap);
export { findRouteNode } from '@tsfullstack/shared-frontend/utils';
export const router = createRouter({
  history: createWebHistory(),
  routes: allRoutes as RouteRecordRaw[],
});

/**
 * 路由错误兜底：当懒加载 chunk 因部署更新而 404 时，刷新页面加载新资源。
 * 发版窗口期的旧页面引用的 chunk 已被删除，检测是否因更新并不可靠（index.html 可能命中缓存），
 * 因此 chunk 错误一律先无脑 reload 一次（sessionStorage 防循环），reload 后仍失败才回首页。
 */
router.onError(async (error) => {
  const isChunkLoadError =
    error?.message?.includes('Failed to fetch dynamically imported module') ||
    error?.message?.includes('Importing a module script failed') ||
    error?.message?.includes('error loading dynamically imported module') ||
    /** Safari 的 chunk 404 报的是找不到模块 */
    error?.message?.includes("Couldn't find the module");
  if (!isChunkLoadError) return;

  const RELOADED_KEY = 'tfs_chunkErrorReloaded';
  if (!sessionStorage.getItem(RELOADED_KEY)) {
    sessionStorage.setItem(RELOADED_KEY, '1');
    window.location.reload();
    return;
  }
  /** reload 过仍失败（可能是网络问题），跳首页避免白屏 */
  console.error('[Router] chunk 加载失败且 reload 无效', error);
  window.location.href = '/';
});

export type RouteObjProps<T extends { component?: ((...args: any) => any) | null | undefined }> =
  T['component'] extends (...args: any) => any
    ? InstanceType<Awaited<ReturnType<NonNullable<T['component']>>>['default']>['$props']
    : never;

export const routerUtil = createRouteUtil(router);

export function createRouteUtil(router: Router) {
  /** 请注意 query 参数的传递方式，尤其是打算传递数组的情况 ，可以使用 query2Arr 辅助处理 */
  const routeUtil = {
    push<T extends RouteNode>(
      obj: T,
      props: T extends { component: any } ? RouteObjProps<T> : undefined,
      query?: Record<string, string | number>,
    ) {
      const targetRouter = getTargetRouter(obj);
      router.push({ name: targetRouter.name, params: props, query: query });
    },
    replace<T extends RouteNode>(
      obj: T,
      props: T extends { component: any } ? RouteObjProps<T> : undefined,
      query?: Record<string, string | number>,
    ) {
      const targetRouter = getTargetRouter(obj);
      router.replace({ name: targetRouter.name, params: props, query: query });
    },
    to<T extends RouteNode>(
      obj: T,
      props: T extends { component: any } ? RouteObjProps<T> : undefined,
      query?: Record<string, string | number>,
    ) {
      const targetRouter = getTargetRouter(obj);
      return { name: targetRouter.name, params: props, query: query } as RouteLocationRaw;
    },
    newBlank<T extends RouteNode>(
      obj: T,
      props: T extends { component: any } ? RouteObjProps<T> : undefined,
      query?: Record<string, string | number>,
    ) {
      const targetRouter = getTargetRouter(obj);
      window.open(
        router.resolve({ name: targetRouter.name, params: props, query: query } as RouteLocationRaw).href,
        '_blank',
        'noopener,noreferrer',
      );
    },

    query2Arr<T>(value: T[] | T | undefined) {
      return Array.isArray(value) ? value : value ? [value] : [];
    },
  };
  return routeUtil;
}
