import { Tracer } from 'effect';

/**
 * 采集到的单条 span 记录（扁平，含 parentSpanId 便于组树）
 */
export interface CollectedSpan {
  /** span 名称（如 Effect.withSpan 的第一个参数） */
  name: string;
  /** span 开始时刻（hrtime 纳秒） */
  startTime: bigint;
  /** span 结束时刻（hrtime 纳秒，未结束则无） */
  endTime?: bigint;
  /** 父 span id（根 span 无） */
  parentSpanId?: string;
  /** span id */
  spanId: string;
  /** 结束时的退出状态（success / failure / interrupted） */
  exit?: string;
}

/**
 * 单个请求的 span 采集器（每个请求创建一个实例，通过 Tracer service 注入）
 */
export interface SpanCollector {
  /** 已采集的 span 列表（span end 时追加） */
  readonly spans: Array<CollectedSpan>;
  /** 对应的 Tracer 实例（provide 给 Effect 运行时用） */
  readonly tracer: Tracer.Tracer;
  /** 请求根 span（首个创建的 span），供 Effect 外的裸 Promise 回调挂载手工 span */
  rootSpan?: Tracer.Span;
  /** 与 Effect span 同源的当前时刻（纳秒）：Effect span 用 fiber Clock 的 wallTimeNanos，
   * 手工 span 若用 process.hrtime 会因时基不同导致时间区间包含关系错乱（无法推导层级） */
  nowNanos(): bigint;
}

/**
 * 请求级 span 采集上限（防止异常请求产生海量 span 撑爆内存/落盘）
 */
const MAX_SPANS = 200;

/**
 * 创建一个请求级 span 采集器：基于 Effect 内置 NativeSpan，span 结束时记录名称/起止时间/父子关系。
 * 用法：Effect.provideService(program, Tracer.Tracer, collector.tracer)，请求结束后读 collector.spans。
 */
export function makeSpanCollector(): SpanCollector {
  const spans: Array<CollectedSpan> = [];
  /** Effect 时基与 hrtime 的差：首次 Effect span 创建时标定，此后手工 span 用它换算到同一时基 */
  let timeOrigin: bigint | undefined;
  const tracer = Tracer.make({
    span(options) {
      if (timeOrigin === undefined) {
        timeOrigin = options.startTime - process.hrtime.bigint();
      }
      const native = new Tracer.NativeSpan(options);
      if (!spans.length) {
        collector.rootSpan = native;
      }
      // 采满即丢弃后续 span 的记录（span 本身仍正常工作，只是不再采集）
      if (spans.length < MAX_SPANS) {
        const record: CollectedSpan = {
          name: options.name,
          startTime: options.startTime,
          spanId: native.spanId,
          parentSpanId: options.parent._tag === 'Some' ? options.parent.value.spanId : undefined,
        };
        spans.push(record);
        const rawEnd = native.end.bind(native);
        native.end = (endTime, exit) => {
          record.endTime = endTime;
          record.exit = exit._tag === 'Failure' ? 'failure' : 'success';
          rawEnd(endTime, exit);
        };
      }
      return native;
    },
  });
  const collector: SpanCollector = {
    spans,
    tracer,
    nowNanos: () => (timeOrigin ?? 0n) + process.hrtime.bigint(),
  };
  return collector;
}

/**
 * 把扁平 span 列表组装成树（子 span 按开始时间排序），并转换为前端瀑布图可用的节点结构。
 * 只保留有耗时的已结束 span；未结束的（如请求被中断）丢弃。
 */
export interface SpanTreeNode {
  name: string;
  /** 相对根 span 开始的时刻（ms） */
  at: number;
  /** 自身耗时（ms，含子 span） */
  ms: number;
  children: Array<SpanTreeNode>;
}

/**
 * 扁平 span → 树。rootAtNsWith 为时基基准（通常是请求根 span 的 startTime）。
 */
export function buildSpanTree(spans: Array<CollectedSpan>, rootAtNs?: bigint): Array<SpanTreeNode> {
  const ended = spans.filter((s): s is CollectedSpan & { endTime: bigint } => s.endTime !== undefined);
  if (ended.length === 0) return [];
  /** 裸回调（cost-logger 插件）建的 sql:db· span 无法读到 fiber context，创建时挂的是根 span；
   * 请求结束后按时间区间重定父级：包含它且耗时最小的 span 即真正包裹它的业务 span，层级由数据自然推导 */
  for (const s of ended) {
    if (!s.name.startsWith('sql:db·')) continue;
    let best: (CollectedSpan & { endTime: bigint }) | undefined;
    for (const c of ended) {
      if (c === s || c.startTime > s.startTime || c.endTime < s.endTime) continue;
      if (!best || c.endTime - c.startTime < best.endTime - best.startTime) best = c;
    }
    s.parentSpanId = best?.spanId;
  }
  const base = rootAtNs ?? ended.reduce((min, s) => (s.startTime < min ? s.startTime : min), ended[0]!.startTime);
  const nsToMs = (ns: bigint) => Number(ns - base) / 1e6;

  const byId = new Map(ended.map((s) => [s.spanId, s]));
  const nodes = new Map(
    ended.map((s) => [
      s.spanId,
      {
        name: s.name,
        at: Math.max(0, nsToMs(s.startTime)),
        ms: nsToMs(s.endTime) - nsToMs(s.startTime),
        children: [] as Array<SpanTreeNode>,
      },
    ]),
  );
  const roots: Array<SpanTreeNode> = [];
  for (const s of ended) {
    const node = nodes.get(s.spanId);
    if (!node) continue;
    const parent = s.parentSpanId ? nodes.get(s.parentSpanId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  /** 排序：按开始时刻 */
  const sortTree = (list: Array<SpanTreeNode>) => {
    list.sort((a, b) => a.at - b.at);
    for (const n of list) sortTree(n.children);
  };
  sortTree(roots);
  // 防御：孤儿链（parent 未被采集但 id 存在于 byId 之外的情况已归入 roots）无需处理
  void byId;
  return roots;
}
