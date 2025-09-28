/** path 为 "" 的子路由会自动渲染在父路由中 */
export const defaultRoute = '';

export interface RouteNodeMeta {
  title?: string;
  icon?: string;
  hidden?: boolean;
  keepAlive?: boolean;
  hideTab?: boolean;
  [key: string]: unknown;
}

export interface RouteNode {
  path: string;
  name?: string;
  child?: RouteTree;
  meta?: RouteNodeMeta;
  props?: ((query: any) => Record<string, unknown>) | Record<string, unknown>;
  children?: RouteNode[];
  redirect?: string | Record<string, any>;
  component?: any;
  components?: Record<string, any>;
}

export type RouteTree = {
  [key: string]: RouteNode;
};

function extractKeyPath(filePath: string): string[] {
  const pathWithoutPrefix = filePath.replace(/^\.\/pages\//, '').replace(/\.routeMap\.ts$/, '');

  const parts = pathWithoutPrefix.split('/').filter(Boolean);

  if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) {
    parts.splice(parts.length - 2, 1);
  }

  return parts;
}

function sortByDepthAsc(entries: [string, RouteNode][]): [string, RouteNode][] {
  return entries.sort((a, b) => extractKeyPath(a[0]).length - extractKeyPath(b[0]).length);
}

export function buildNestedTree(modules: Record<string, RouteNode>): RouteTree {
  const root: RouteTree = {};

  const sortedEntries = sortByDepthAsc(Object.entries(modules));

  for (const [filePath, node] of sortedEntries) {
    // 判断是否是绝对路径
    if (node.path && node.path.startsWith('/')) {
      // 提升为顶级路由
      const key = node.name || extractKeyPath(filePath).slice(-1)[0]!;
      root[key] = {
        ...node,
        child: node.child || {},
      };
      continue;
    }

    // 否则按文件路径构建嵌套结构
    const keys = extractKeyPath(filePath);
    const parentKeys = keys.slice(0, -1);
    const selfKey = keys[keys.length - 1]!;
    insertIntoTree(root, parentKeys, selfKey, node);
  }

  return root;
}

function insertIntoTree(
  tree: RouteTree,
  parents: string[],
  selfKey: string,
  node: RouteNode,
): void {
  let current = tree;

  for (const key of parents) {
    if (!current[key]) {
      current[key] = {
        path: '',
        name: key,
        redirect: undefined,
        child: {},
      } as RouteNode;
    }

    if (!current[key].child) {
      current[key].child = {};
    }

    current = current[key].child as RouteTree;
  }

  const existingNode = current[selfKey];
  const mergedChild: RouteTree = {
    ...(existingNode?.child || {}),
    ...(node.child || {}),
  };

  const mergedNode: RouteNode = {
    ...(existingNode || {}),
    ...node,
    child: mergedChild,
  };

  current[selfKey] = mergedNode;
}

let routeNameId = 0;
/** 将树形结构转换为 RouteNode[] 数组结构，便于路由注册使用
 * 会自动为路由添加 name 属性，如果路由没有 name 属性，会自动生成一个唯一的 name 属性
 */
export function transformRoutes(tree?: RouteTree): RouteNode[] {
  if (tree === undefined) return [];
  return Object.entries(tree).map(([_, route]) => {
    if (route.name === undefined) {
      route.name = `route-${routeNameId++}`;
    }
    if (route.props === undefined) {
      route.props = (route) => ({ ...route.query, ...route.params });
    }

    return {
      ...route,
      children: route.child ? transformRoutes(route.child) : [],
    };
  });
}

export function findRouteNode(
  routes: RouteNode[],
  predicate: (node: RouteNode) => boolean,
): RouteNode | undefined {
  for (const route of routes) {
    if (predicate(route)) return route;
    if (route.children) {
      const found = findRouteNode(route.children as any, predicate);
      if (found) return found;
    }
  }
  return undefined;
}

/** 因为vue router 的逻辑比较奇葩，如果父路由命名的话，它就不会自动的跳到子路由他必须要子路由没有名称才行。 */
export function getTargetRouter(obj: RouteNode): RouteNode {
  if (obj.child) {
    const targetRouter =
      Object.values(obj.child ?? {}).find((el: RouteNode) => el.path === defaultRoute) ?? obj;
    return getTargetRouter(targetRouter);
  } else {
    return obj;
  }
}

/** 类型安全的路由展开工具 */
export type ExpandRouteMap<T extends Record<string, RouteTree>> = {
  [K in keyof T]: T[K] extends RouteTree ? T[K] : never;
}[keyof T];

/** 动态展开所有模块路由，等同于手动写 ...autoLoadRouteMap.template, ...autoLoadRouteMap.template2 的效果 */
export function expandRouteMaps<T extends Record<string, RouteTree>>(
  routeMaps: T
): ExpandRouteMap<T> {
  const result: RouteTree = {};

  // 遍历所有模块路由映射并展开
  for (const [, moduleRouteMap] of Object.entries(routeMaps)) {
    Object.assign(result, moduleRouteMap);
  }

  return result as ExpandRouteMap<T>;
}

/** 获取展开后的路由类型 */
export type ExpandedRouteMap<T extends Record<string, RouteTree>> = ReturnType<
  typeof expandRouteMaps<T>
>;