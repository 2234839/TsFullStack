/** ABOUTME: 客户端IP获取Effect，封装了反向代理处理逻辑 */

import { Effect } from 'effect';
import { ReqCtxService } from './ReqCtx';

/** 获取客户端IP（考虑 nginx 反向代理） */
export const reqClientIpEffect = Effect.gen(function* () {
  const ctx = yield* ReqCtxService;
  // 获取客户端IP（考虑 nginx 反向代理）
  const clientIP = (ctx.req.headers['x-forwarded-for'] as string) || ctx.req.ip;
  return clientIP;
});
