import { Context } from 'effect';
import type { Database } from './Auth';
/** 通用 JSON 值类型 */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
import type { FastifyRequest } from 'fastify';

export class ReqCtxService extends Context.Tag('ReqCtxService')<ReqCtxService, ReqCtx>() {}

/** 请求上下文数据 */
export type ReqCtx = {
  user?: Database['user'];
  logs: JsonValue[];
  log(...args: JsonValue[]): void;
  req: FastifyRequest;
  reqId: number;
};
