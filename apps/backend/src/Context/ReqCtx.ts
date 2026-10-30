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
  /** 耗时 ms */
  ms: number;
  /** 请求内相对时刻 ms（自请求开始） */
  at: number;
};

/** 请求上下文数据 */
export type ReqCtx = {
  user?: Database['user'];
  logs: JsonValue[];
  log(...args: JsonValue[]): void;
  req: FastifyRequest;
  reqId: number;
  /** 请求开始时刻（performance.now 时基，与 LoopLagMonitor 一致） */
  t0: number;
  /** 本请求的 SQL 执行明细（诊断用，onQuery 填充） */
  sqlEvents: SqlEvent[];
  /** 请求级 span 采集器（server/index.ts 装配），onQuery 钩子用它把 SQL 挂进执行栈 */
  spanCollector?: SpanCollector;
};
