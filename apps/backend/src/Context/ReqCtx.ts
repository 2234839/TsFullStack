import { Context } from 'effect';
import type { Database } from './Auth';
import type { JsonValue } from '@zenstackhq/orm';
import type { FastifyRequest } from 'fastify';
import type { SpanCollector } from '../util/EffectSpanCollector';

export class ReqCtxService extends Context.Service<ReqCtxService, ReqCtx>()('ReqCtxService') {}

/** 单条 SQL 执行记录（onQuery 钩子采集） */
export type SqlEvent = {
  /** 数据模型名（如 User） */
  model: string;
  /** 操作（findFirst/create/update...） */
  operation: string;
  /** 耗时 ms（含 ORM 校验/建查询的包装开销） */
  ms: number;
  /** 驱动层真实执行耗时 ms（注释 id 认领），ms - execMs 即 ZenStack 包装开销 */
  execMs?: number;
  /** 请求内相对时刻 ms（自请求开始） */
  at: number;
  /** 本次操作认领的驱动层语句（含权限检查子查询），归属精确到本调用 */
  driver?: Array<{ id: number; ms: number; sql: string }>;
};

/** 单次跨线程 DB 调用的三段耗时分解（worker 模式专用） */
export type DbCallTiming = {
  /** 调用的点分方法路径（如 user.findMany） */
  method: string;
  /** 调用发出时刻（请求内相对 ms） */
  at: number;
  /** 投递排队：主线程发出 → worker 开始处理（含跨线程消息投递与 worker 内排队） */
  queueMs: number;
  /** worker 执行：ORM 校验/建查询 + 驱动真实执行（含 worker 内被其他调用插入的串行等待） */
  execMs: number;
  /** 回传：worker 完成响应 → 主线程收到（结构化克隆跨线程回传） */
  returnMs: number;
};

/** 请求上下文数据 */
export type ReqCtx = {
  user?: Database['user'];
  logs: JsonValue[];
  log(...args: JsonValue[]): void;
  req: FastifyRequest;
  /** 响应对象（如 set-cookie 需要在 RPC 内部写入响应头） */
  reply?: import('fastify').FastifyReply;
  reqId: number;
  /** 请求开始时刻（performance.now 时基，与 LoopLagMonitor 一致） */
  t0: number;
  /** 本请求的 SQL 执行明细（诊断用，onQuery 填充） */
  sqlEvents: SqlEvent[];
  /** 跨线程 DB 调用三段耗时分解（诊断用，worker 模式 doCall 填充；直连模式恒为空） */
  dbTimings: DbCallTiming[];
  /** 请求级 span 采集器（server/index.ts 装配），onQuery 钩子用它把 SQL 挂进执行栈 */
  spanCollector?: SpanCollector;
};
