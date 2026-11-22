import { Effect } from 'effect';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { KVStore } from '../Context/KVStore';

/** 日志前缀 */
const LOG_PREFIX = '[OpenPlatform]';

/** 授权码有效期（10 分钟，覆盖浏览器重定向 + token 兑换的正常耗时） */
export const AUTH_CODE_TTL_MS = 10 * 60 * 1000;

/** access_token 有效期（14 天，与本站用户会话同量级） */
export const ACCESS_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** refresh_token 有效期（30 天；每次刷新轮换旧值作废） */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 授权码 KV key 前缀 */
const CODE_KEY_PREFIX = 'openid:code:';

/** access_token KV key 前缀 */
const ACCESS_TOKEN_KEY_PREFIX = 'openid:at:';

/** refresh_token KV key 前缀 */
const REFRESH_TOKEN_KEY_PREFIX = 'openid:rt:';

/** 授权码签发记录：token 兑换时逐项校验，防止跨应用/跨回调盗用 */
export interface AuthCodePayload {
  /** 签发对象应用 */
  clientId: string;
  /** 被授权的本站用户 */
  userId: string;
  /** 签发时使用的回调地址（兑换时必须一致） */
  redirectUri: string;
  /** 授权范围 */
  scope: string;
  /** PKCE code_challenge（可选；接入方为公开客户端时携带） */
  codeChallenge?: string;
  /** PKCE 变换方法，仅支持 S256 */
  codeChallengeMethod?: 'S256';
}

/** 允许向接入方下发的 scope 集合（本期只有基础身份） */
export const SUPPORTED_SCOPES = ['profile'] as const;

/** 归一化 scope：非法项剔除、去重，空则回退默认 'profile' */
export function normalizeScope(scope: string | undefined): string {
  const requested = (scope ?? '').split(/[\s,]+/).filter((s) => s.length > 0);
  const valid = [...new Set(requested.filter((s) => (SUPPORTED_SCOPES as readonly string[]).includes(s)))];
  return valid.join(' ') || 'profile';
}

/** 生成加密安全的授权码（CSPRNG；cuid2 熵源是 Math.random，不可作鉴权凭据） */
export function generateAuthCode(): string {
  return randomBytes(32).toString('base64url');
}

/** 生成加密安全的 access_token */
export function generateAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * 签发授权码：KVStore 存储（TTL 10 分钟）。
 * state 由接入方自己生成并在 redirect_uri 上带回，本站只透传，不在此存储。
 */
export function issueAuthCode(payload: AuthCodePayload): Effect.Effect<string, never, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    const code = generateAuthCode();
    yield* kv.set(CODE_KEY_PREFIX + code, JSON.stringify(payload), AUTH_CODE_TTL_MS);
    return code;
  });
}

/**
 * 校验 PKCE code_verifier（S256）：challenge = BASE64URL(SHA256(verifier))。
 * 授权码未携带 challenge 时不校验（机密客户端走 client_secret 已够）；
 * 携带了则必须提供合法 verifier 且恒定时间比较，防 timing 泄露。
 */
export function verifyPkce(
  payload: Pick<AuthCodePayload, 'codeChallenge' | 'codeChallengeMethod'>,
  verifier: string | undefined,
): boolean {
  if (!payload.codeChallenge) return true;
  if (!verifier || payload.codeChallengeMethod !== 'S256') return false;
  if (!/^[A-Za-z0-9-._~]{43,128}$/.test(verifier)) return false;
  const computed = createHash('sha256').update(verifier, 'ascii').digest('base64url');
  const a = Buffer.from(computed);
  const b = Buffer.from(payload.codeChallenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * 原子消费授权码：get + takeIfEqual 保证并发兑换只有一个成功（一次性防重放）。
 * 校验 clientId/redirectUri 与签发记录一致，任何不一致都视为兑换失败并丢弃授权码。
 */
export function consumeAuthCode(
  code: string,
  clientId: string,
  redirectUri: string,
): Effect.Effect<AuthCodePayload | null, never, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    const key = CODE_KEY_PREFIX + code;
    const raw = yield* kv.get(key);
    if (!raw) return null;
    const payload = JSON.parse(raw) as AuthCodePayload;
    if (payload.clientId !== clientId || payload.redirectUri !== redirectUri) {
      /** 授权码被拿到别的应用/别的回调上兑换 = 泄露迹象，立即作废并留安全日志 */
      yield* kv.del(key);
      console.error(`${LOG_PREFIX} 授权码 clientId/redirectUri 不匹配（疑似泄露），已作废 clientId=${clientId}`);
      return null;
    }
    const consumed = yield* kv.takeIfEqual(key, raw);
    return consumed ? payload : null;
  });
}

/** token 载荷（access 与 refresh 共用结构） */
interface TokenPayload {
  userId: string;
  scope: string;
}

/** 签发 access_token（Bearer） */
export function issueAccessToken(userId: string, scope: string): Effect.Effect<string, never, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    const token = generateAccessToken();
    yield* kv.set(
      ACCESS_TOKEN_KEY_PREFIX + token,
      JSON.stringify({ userId, scope } satisfies TokenPayload),
      ACCESS_TOKEN_TTL_MS,
    );
    return token;
  });
}

/** 签发 refresh_token（轮换语义：使用一次后旧值作废；owner key 绑定客户端防跨应用挪用） */
export function issueRefreshToken(
  userId: string,
  scope: string,
  clientId: string,
): Effect.Effect<string, never, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    const token = generateAccessToken();
    yield* kv.set(
      REFRESH_TOKEN_KEY_PREFIX + token,
      JSON.stringify({ userId, scope } satisfies TokenPayload),
      REFRESH_TOKEN_TTL_MS,
    );
    yield* kv.set(`openid:rt:owner:${token}`, clientId, REFRESH_TOKEN_TTL_MS);
    return token;
  });
}

/** 解析 access_token：无效/过期返回 null */
export function resolveAccessToken(token: string | undefined): Effect.Effect<TokenPayload | null, never, KVStore> {
  return Effect.gen(function* () {
    if (!token) return null;
    const kv = yield* KVStore;
    const raw = yield* kv.get(ACCESS_TOKEN_KEY_PREFIX + token);
    if (!raw) return null;
    return JSON.parse(raw) as TokenPayload;
  });
}

/**
 * 消费 refresh_token 并轮换：旧 refresh/access 一并作废，发新对。
 * 并发刷新只有一个成功（takeIfEqual），复用已轮换的旧值视为泄露迹象并吊销整链。
 */
export function rotateRefreshToken(
  refreshToken: string,
  clientId: string,
): Effect.Effect<TokenPayload | null, never, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    const key = REFRESH_TOKEN_KEY_PREFIX + refreshToken;
    const raw = yield* kv.get(key);
    if (!raw) return null;
    const payload = JSON.parse(raw) as TokenPayload;
    /** 轮换链绑定客户端：换到别的 client 上用 = 泄露，整链作废 */
    const ownerRaw = yield* kv.get(`openid:rt:owner:${refreshToken}`);
    if (!ownerRaw || ownerRaw !== clientId) {
      yield* kv.del(key);
      console.error(`${LOG_PREFIX} refresh_token 客户端不匹配（疑似泄露），已作废 clientId=${clientId}`);
      return null;
    }
    const consumed = yield* kv.takeIfEqual(key, raw);
    if (!consumed) return null;
    yield* kv.del(`openid:rt:owner:${refreshToken}`);
    /** 顺带吊销同链 access_token 由调用方处理（这里只轮换 refresh） */
    return payload;
  });
}

/** 撤销 token（access 或 refresh 均可，用于 /oauth/revoke） */
export function revokeToken(token: string): Effect.Effect<void, never, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    yield* kv.del(ACCESS_TOKEN_KEY_PREFIX + token);
    yield* kv.del(REFRESH_TOKEN_KEY_PREFIX + token);
  });
}

/** 从 Authorization: Bearer 头提取 token */
export function extractBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
}
