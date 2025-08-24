import type { RouteRecordRaw } from 'vue-router';
/** path 为 "" 的子路由会自动渲染在父路由中 */
export const defaultRoute = '';

export type RouteNode = RouteRecordRaw & {
  child?: RouteTree;
  meta?: {};
  name?: string;
};
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
    if (node.path.startsWith('/')) {
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
        redirect: '',
        child: {},
      };
    }

    if (!current[key].child) {
      current[key].child = {};
    }

    current = current[key].child!;
  }

  //@ts-expect-error
  current[selfKey] = {
    ...(current[selfKey] || {}),
    ...node,
    child: {
      ...current[selfKey]?.child,
      ...node.child,
    },
  };
}
