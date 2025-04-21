import {
  createRouter,
  createWebHistory,
  type RouteLocationRaw,
  type Router,
  type RouteRecordRaw,
} from 'vue-router';
/** path 为 "" 的子路由会自动渲染在父路由中 */
export const defaultRoute = '';

export const routeMap = {
  index: {
    path: '/',
    redirect: '/admin',
  },
  admin: {
    path: '/admin',
    component: () => import('./pages/admin/AdminLayout.vue'),
    child: {
      index: {
        path: '',
        component: () => import('./pages/admin/index.vue'),
      },
    },
  },
  login: {
    path: '/login',
    component: () => import('./pages/login.vue'),
  },
} satisfies RouteTree;

type RouteNode = RouteRecordRaw & { child?: RouteTree };
type RouteTree = {
  [key: string]: RouteNode;
};

let routeNameId = 0;
/** 将树形结构转换为 RouteRecordRaw[] 数组结构，便于路由注册使用
 * 会自动为路由添加 name 属性，如果路由没有 name 属性，会自动生成一个唯一的 name 属性
 */
function transformRoutes(tree?: RouteTree): RouteRecordRaw[] {
  if (tree === undefined) return [];
  return Object.entries(tree).map(([_, route]) => {
    if (route.name === undefined) {
      route.name = `route-${routeNameId++}`;
    }
    return {
      ...route,
      children: route.child ? transformRoutes(route.child) : [],
    };
  });
}

const routes: RouteRecordRaw[] = transformRoutes(routeMap);
export const router = createRouter({
  history: createWebHistory(),
  routes,
});

export type RouteObjProps<T extends { component?: ((...args: any) => any) | null | undefined }> =
  T['component'] extends (...args: any) => any
    ? InstanceType<Awaited<ReturnType<NonNullable<T['component']>>>['default']>['$props']
    : never;

/** 因为vue router 的逻辑比较奇葩，如果父路由命名的话，它就不会自动的跳到子路由他必须要子路由没有名称才行。 */
function getTargetRouter(obj: RouteNode) {
  if (obj.child) {
    const targetRouter =
      Object.values(obj.child ?? {}).find((el) => el.path === defaultRoute) ?? obj;
    return getTargetRouter(targetRouter);
  } else {
    return obj;
  }
}
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
    to<T extends RouteNode>(
      obj: T,
      props: T extends { component: any } ? RouteObjProps<T> : undefined,
      query?: T extends { component: any } ? Partial<RouteObjProps<T>> : undefined,
    ) {
      const targetRouter = getTargetRouter(obj);
      return { name: targetRouter.name, params: props, query: query } as RouteLocationRaw;
    },
    newBlank<T extends RouteNode>(obj: T) {
      window.open(router.resolve({ name: obj.name }).href, '_blank');
    },
    query2Arr<T>(value: T[] | T | undefined) {
      return Array.isArray(value) ? value : value ? [value] : [];
    },
  };
  return routeUtil;
}
