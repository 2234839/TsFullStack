import { Context } from 'effect';
import type { Database } from './Auth';
import type { JsonValue } from 'effect/FastCheck';
import type { FastifyRequest } from 'fastify';

export class ReqCtxService extends Context.Tag('ReqCtxService')<ReqCtxService, ReqCtx>() {}

/** 请求上下文数据 */
export type ReqCtx = {
  user?: Database['user'];
  logs: JsonValue[];
  log(...args: JsonValue[]): void;
  req: FastifyRequest;
};
