import {
  createRouter,
  createWebHistory,
  type RouteLocationRaw,
  type Router,
} from 'vue-router';
import { t as i18n_t } from './i18n';
import { computed, reactive } from 'vue';
import { buildNestedTree, transformRoutes, getTargetRouter, type RouteNode, type RouteTree } from '@tsfullstack/shared-frontend/utils';
/** path 为 "" 的子路由会自动渲染在父路由中 */
export const defaultRoute = '';

const t = (key: string) => computed(() => i18n_t(key));

let routeModels: Record<string, RouteNode>;

routeModels = import.meta.glob(`./**/*.routeMap.ts`, {
  import: 'default',
  eager: true,
});


// 动态导入启用的包路由
const enabledPackages = import.meta.env.VITE_ENABLED_PACKAGES?.split(',') || [];
console.log('Enabled packages:', enabledPackages);

// 动态导入启用的包路由
// enabledPackages.forEach(packageName => {
//   try {
//     // 通过正常的模块导入方式加载子包路由
//     const packageRouteMap = require(`${packageName}/index.routeMap`).default;
//     routeModels[`packages/${packageName}/index.routeMap`] = packageRouteMap;
//     console.log(`Added route for package: ${packageName}`);
//   } catch (error) {
//     console.warn(`Failed to load route for package: ${packageName}`, error);
//   }
// });


const routeModelTree = buildNestedTree(routeModels);

console.log('Final routeModelTree:', routeModelTree);

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
        component: () => import('@/pages/admin/index.vue'),
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
        component: () => import('@/pages/admin/SystemLog.vue'),
        meta: {
          title: t('系统日志'),
          icon: 'pi pi-file',
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
      aiModelManager: {
        path: 'aiModelManager',
        component: () => import('@/pages/admin/AiModelManager.vue'),
        meta: {
          title: t('AI模型管理'),
          icon: 'pi pi-microchip-ai',
        },
      },
    },
  },
  ShareDetail: {
    path: '/ShareDetail/:id',
    component: () => import('@/pages/share/ShareDetail.vue'),
    meta: {
      title: t('分享详情'),
      icon: 'pi pi-share',
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
  VrImg: {
    path: '/VrImg',
    component: () => import('@/pages/VrImg/VrImg.vue'),
    meta: {
      title: t('VR图片'),
      icon: 'pi pi-image',
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
    redirect: defaultRoute,
    child: {
      tempTest: {
        path: 'tempTest',
        component: () => import('@/pages/tests/tempTest.vue'),
        meta: {
          title: t('临时测试页面'),
          icon: 'pi pi-chart-line',
        },
      },
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
  redirect: {
    path: '/redirect',
    component: () => import('@/pages/Redirect.vue'),
    meta: {
      title: t('重定向'),
      hideTab: true,
    },
  },
}) satisfies RouteTree;

export const allRoutes: RouteNode[] = transformRoutes(routeMap);
export { findRouteNode } from '@tsfullstack/shared-frontend/utils';
export const router = createRouter({
  history: createWebHistory(),
  routes: allRoutes as any,
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
      query?: T extends { component: any } ? Partial<RouteObjProps<T>> : undefined,
    ) {
      const targetRouter = getTargetRouter(obj);
      router.push({ name: targetRouter.name, params: props, query: query });
    },
    replace<T extends RouteNode>(
      obj: T,
      props: T extends { component: any } ? RouteObjProps<T> : undefined,
      query?: T extends { component: any } ? Partial<RouteObjProps<T>> : undefined,
    ) {
      const targetRouter = getTargetRouter(obj);
      router.replace({ name: targetRouter.name, params: props, query: query });
    },
    to<T extends RouteNode>(
      obj: T,
      props: T extends { component: any } ? RouteObjProps<T> : undefined,
      query?: T extends { component: any } ? Partial<RouteObjProps<T>> : undefined,
    ) {
      const targetRouter = getTargetRouter(obj);
      return { name: targetRouter.name, params: props, query: query } as RouteLocationRaw;
    },
    newBlank<T extends RouteNode>(
      obj: T,
      props: T extends { component: any } ? RouteObjProps<T> : undefined,
      query?: T extends { component: any } ? Partial<RouteObjProps<T>> : undefined,
    ) {
      const targetRouter = getTargetRouter(obj);
      window.open(
        router.resolve({ name: targetRouter.name, params: props, query: query } as RouteLocationRaw)
          .href,
        '_blank',
      );
    },

    query2Arr<T>(value: T[] | T | undefined) {
      return Array.isArray(value) ? value : value ? [value] : [];
    },
  };
  return routeUtil;
}
