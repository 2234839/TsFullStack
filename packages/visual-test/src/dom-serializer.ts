/**
 * DOM 结构序列化：将页面 DOM 转为可对比的结构化 JSON
 *
 * 忽略文本内容、动态属性，只保留结构信息（tag、class、属性骨架）。
 * 这样 <td>张三</td> 和 <td>李四</td> 结构一致，不会误报。
 */

/** 序列化后的 DOM 节点 */
export interface SerializedNode {
  /** 标签名（小写） */
  tag: string;
  /** class 列表（排序后去重） */
  class?: string[];
  /** 关键属性（只保留影响渲染的属性，忽略 value、src、href 等） */
  attrs?: Record<string, string>;
  /** 子节点 */
  children?: SerializedNode[];
}

/** 序列化时要忽略的标签（不影响视觉渲染） */
const IGNORE_TAGS = new Set(["script", "style", "link", "meta", "noscript", "svg", "path"]);

/** 序列化时要保留的属性（影响布局/视觉的属性） */
const KEEP_ATTRS = new Set([
  "class",
  "id",
  "role",
  "aria-label",
  "aria-hidden",
  "data-test",
  "type",
  "href",
  "placeholder",
  "disabled",
  "checked",
  "selected",
  "colspan",
  "rowspan",
  "target",
  "rel",
]);

/** 忽略的属性值前缀（Vue 内部属性等） */
const IGNORE_ATTR_PREFIX = ["data-v-", "aria-", "aria_"];

/**
 * 在浏览器上下文中执行：序列化整个 body 的 DOM 结构
 * 此函数会被注入到 page.evaluate() 中运行
 */
export function serializeDom(): string {
  const walk = (el: Element): SerializedNode | null => {
    const tag = el.tagName.toLowerCase();

    // 跳过不影响渲染的标签
    if (IGNORE_TAGS.has(tag)) return null;

    // 跳过 display:none 的元素
    const style = window.getComputedStyle(el);
    if (style.display === "none") return null;

    const node: SerializedNode = { tag };

    // class
    if (el.className && typeof el.className === "string") {
      node.class = el.className
        .split(/\s+/)
        .filter((c) => c && !c.startsWith("data-v-"))
        .sort();
      if (node.class.length === 0) delete node.class;
    }

    // 属性（只保留关键属性）
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name;
      // 跳过 Vue 内部属性和动态属性
      if (IGNORE_ATTR_PREFIX.some((p) => name.startsWith(p)) && !KEEP_ATTRS.has(name)) {
        continue;
      }
      if (KEEP_ATTRS.has(name)) {
        attrs[name] = attr.value;
      }
    }
    if (Object.keys(attrs).length > 0) {
      node.attrs = attrs;
    }

    // 子节点
    const children: SerializedNode[] = [];
    for (const child of Array.from(el.children)) {
      const serialized = walk(child);
      if (serialized) children.push(serialized);
    }
    if (children.length > 0) {
      node.children = children;
    }

    return node;
  };

  const body = document.body;
  if (!body) return "{}";

  const result = walk(body);
  return JSON.stringify(result, null, 2);
}

/**
 * 对比两个 DOM JSON 字符串，返回差异描述
 */
export function diffDomJson(
  baseline: string,
  current: string,
): { identical: boolean; diff?: string } {
  if (baseline === current) {
    return { identical: true };
  }

  let baselineObj: unknown;
  let currentObj: unknown;

  try {
    baselineObj = JSON.parse(baseline);
    currentObj = JSON.parse(current);
  } catch {
    return { identical: false, diff: "JSON 解析失败" };
  }

  const diffs: string[] = [];
  compareNodes(baselineObj, currentObj, "", diffs);

  if (diffs.length === 0) {
    return { identical: true };
  }

  return {
    identical: false,
    diff: diffs.slice(0, 20).join("\n"),
  };
}

/** 递归对比两个序列化节点 */
function compareNodes(baseline: unknown, current: unknown, path: string, diffs: string[]): void {
  if (
    typeof baseline !== "object" ||
    typeof current !== "object" ||
    baseline === null ||
    current === null
  ) {
    if (baseline !== current) {
      diffs.push(
        `${path || "(root)"}: 值不同 ${JSON.stringify(baseline)} → ${JSON.stringify(current)}`,
      );
    }
    return;
  }

  const b = baseline as SerializedNode;
  const c = current as SerializedNode;

  if (b.tag !== c.tag) {
    diffs.push(`${path}: 标签变化 ${b.tag} → ${c.tag}`);
    return;
  }

  const currentPath = path || b.tag;

  // 对比 class
  const bClass = b.class ?? [];
  const cClass = c.class ?? [];
  if (JSON.stringify(bClass) !== JSON.stringify(cClass)) {
    const added = cClass.filter((x) => !bClass.includes(x));
    const removed = bClass.filter((x) => !cClass.includes(x));
    const parts: string[] = [];
    if (added.length) parts.push(`+${added.join(",")}`);
    if (removed.length) parts.push(`-${removed.join(",")}`);
    diffs.push(`${currentPath}.class: ${parts.join(" ")}`);
  }

  // 对比属性
  const bAttrs = b.attrs ?? {};
  const cAttrs = c.attrs ?? {};
  const allAttrKeys = new Set([...Object.keys(bAttrs), ...Object.keys(cAttrs)]);
  for (const key of allAttrKeys) {
    if (bAttrs[key] !== cAttrs[key]) {
      diffs.push(`${currentPath}[${key}]: ${bAttrs[key] ?? "(无)"} → ${cAttrs[key] ?? "(无)"}`);
    }
  }

  // 对比子节点数量
  const bChildren = b.children ?? [];
  const cChildren = c.children ?? [];
  if (bChildren.length !== cChildren.length) {
    diffs.push(`${currentPath}: 子节点数量 ${bChildren.length} → ${cChildren.length}`);
  }

  // 递归对比子节点
  const minLen = Math.min(bChildren.length, cChildren.length);
  for (let i = 0; i < minLen; i++) {
    compareNodes(bChildren[i], cChildren[i], `${currentPath}>[${i}]`, diffs);
  }
}
