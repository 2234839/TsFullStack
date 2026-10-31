import { randomBytes } from 'node:crypto';

/** OAuth 随机密码字节数 */
const OAUTH_PASSWORD_BYTES = 32;

/** OAuth 伪邮箱随机字节数（8字节=16hex + "@oauth.local"11字符 = 27字符，不超过 email 字段 @length(6,32) 限制） */
const OAUTH_EMAIL_RANDOM_BYTES = 8;

/** 生成加密安全的随机密码（OAuth 用户不会通过密码登录，仅满足数据库非空约束） */
export function generateSecureRandomPassword(): string {
  return randomBytes(OAUTH_PASSWORD_BYTES).toString('hex');
}

/** 生成伪随机邮箱（OAuth 用户不使用邮箱登录，仅满足数据库唯一约束） */
export function generateFakeEmail(): string {
  return `${randomBytes(OAUTH_EMAIL_RANDOM_BYTES).toString('hex')}@oauth.local`;
}

/** OAuth state 有效期（与 OAuth/github.ts 的 OAUTH_STATE_TTL_MS 一致） */
const OAUTH_STATE_COOKIE_MAX_AGE = 10 * 60;

/** 手动解析 Cookie 头（项目未引 @fastify/cookie，避免为一个字段加依赖） */
function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

/**
 * 把 OAuth state 绑定到当前浏览器（httpOnly cookie，防 login CSRF：攻击者无法让自己的 state 在受害者浏览器中登记）
 * 同一 provider 重复发起会被覆盖（一次性回调只校验最新一次）
 */
export function setOAuthStateCookie(
  reqCtx: {
    req: { headers: { cookie?: string } };
    reply?: { header: (k: string, v: unknown) => unknown; getHeader?: (k: string) => unknown };
  },
  provider: 'github' | 'linuxdo',
  state: string,
): void {
  const name = `oauth_state_${provider}`;
  const cookie = `${name}=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${OAUTH_STATE_COOKIE_MAX_AGE}`;
  /** append 避免覆盖其他 set-cookie */
  const existing = reqCtx.reply?.getHeader?.('set-cookie');
  if (existing) {
    const merged = (Array.isArray(existing) ? existing.slice() : [String(existing)]) as string[];
    merged.push(cookie);
    reqCtx.reply?.header('set-cookie', merged);
  } else {
    reqCtx.reply?.header('set-cookie', cookie);
  }
}

/** 校验回调时浏览器携带的 state cookie 与回调 state 一致（防跨浏览器 login CSRF） */
export function verifyOAuthStateCookie(
  reqCtx: { req: { headers: { cookie?: string } } },
  provider: 'github' | 'linuxdo',
  state: string | undefined,
): boolean {
  if (!state) return false;
  return parseCookies(reqCtx.req.headers.cookie)[`oauth_state_${provider}`] === state;
}
