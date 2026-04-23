/** ABOUTME: 客户端IP获取Effect，封装了反向代理处理逻辑 */

import { Effect } from 'effect';
import { ReqCtxService } from './ReqCtx';

/** IPv4 地址正则（简化版，覆盖标准格式） */
const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;

/** 验证字符串是否为合法的 IPv4 地址 */
function isValidIPv4(ip: string): boolean {
  if (!IPV4_PATTERN.test(ip)) return false;
  return ip.split('.').every((octet) => {
    const num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
}

/** 获取客户端IP（考虑 nginx 反向代理，带格式验证防伪造） */
export const reqClientIpEffect = Effect.gen(function* () {
  const ctx = yield* ReqCtxService;
  const forwarded = ctx.req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const candidate = forwarded.split(',')[0]?.trim();
    if (candidate && isValidIPv4(candidate)) {
      return candidate;
    }
  }
  return ctx.req.ip;
});
