import { Effect } from 'effect';
import { randomBytes } from 'node:crypto';
import { fail, requireOrFail } from '../../util/error';
import { DbClientEffect } from '../../Context/DbService';
import { AuthContext, optionalUserId as currentUserId, requireAdmin } from '../../Context/Auth';
import { dbTry } from '../../util/dbEffect';
import { hashPassword } from '../../util/crypto';
import type { JsonValue } from '@zenstackhq/orm';
import { issueAuthCode, normalizeScope } from '../../OpenPlatform/service';
import { findClient, parseRedirectUris, redirectUriAllowed } from '../../OpenPlatform/clients';

/** 日志前缀 */
const LOG_PREFIX = '[OpenPlatformApi]';

/** CLIENT_ID 随机字节数（24 字节 = 32 base64url 字符） */
const CLIENT_ID_BYTES = 24;
/** CLIENT_SECRET 随机字节数 */
const CLIENT_SECRET_BYTES = 32;

/** 生成 clientId（公开标识，随机足够长即可防猜测） */
function generateClientId(): string {
  return 'tsfs_' + randomBytes(CLIENT_ID_BYTES).toString('base64url');
}

/** 生成 clientSecret（明文只在创建响应中出现一次） */
function generateClientSecret(): string {
  return randomBytes(CLIENT_SECRET_BYTES).toString('base64url');
}

/** 校验回调地址形态：必须是 http(s) 绝对地址 */
function isValidRedirectUri(uri: string): boolean {
  return /^https?:\/\/[^\s]+$/.test(uri);
}

/** 统一取出并校验回调地址列表输入 */
function sanitizeRedirectUris(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const uris = input.filter((u): u is string => typeof u === 'string');
  if (uris.length === 0 || uris.some((u) => !isValidRedirectUri(u))) return null;
  return uris;
}

/** 开放平台 RPC：授权确认页与接入应用管理 */
export const openPlatformApi = {
  /** 授权确认页查询应用展示信息（公开：仅需 clientId，不下发 secret 相关字段） */
  describeClient(clientId: string) {
    return Effect.gen(function* () {
      if (!clientId) return yield* fail('缺少 client_id');
      const dbClient = yield* DbClientEffect;
      const client = yield* dbTry(LOG_PREFIX, '查询接入应用', () => findClient(dbClient, clientId));
      if (!client || client.disabled) return yield* fail('应用不存在或已禁用');
      return { name: client.name, homepage: client.homepage ?? null };
    });
  },

  /**
   * 授权确认：校验应用与回调后签发一次性授权码，返回带 code/state 的重定向地址（需登录态）。
   * PKCE（S256）：接入方为公开客户端时传 code_challenge，token 兑换时须回传 code_verifier。
   */
  approve(params: {
    clientId: string;
    redirectUri: string;
    state?: string;
    scope?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }) {
    return Effect.gen(function* () {
      const userId = yield* currentUserId();
      if (!userId) return yield* fail('请先登录');
      const { clientId, redirectUri } = params;
      if (!clientId || !redirectUri) return yield* fail('缺少 client_id 或 redirect_uri');
      const scope = normalizeScope(params.scope);

      /** PKCE 参数合法性：仅支持 S256，challenge 必须是 43~128 位 base64url */
      let codeChallenge: string | undefined;
      if (params.codeChallenge) {
        if (params.codeChallengeMethod !== 'S256') {
          return yield* fail('code_challenge_method 仅支持 S256');
        }
        if (!/^[A-Za-z0-9-._]{43,128}$/.test(params.codeChallenge)) {
          return yield* fail('code_challenge 格式非法');
        }
        codeChallenge = params.codeChallenge;
      }

      const dbClient = yield* DbClientEffect;
      const client = yield* dbTry(LOG_PREFIX, '查询接入应用', () => findClient(dbClient, clientId));
      if (!client || client.disabled) return yield* fail('应用不存在或已禁用');
      if (!redirectUriAllowed(client, redirectUri)) {
        return yield* fail('redirect_uri 与注册列表不匹配');
      }

      const code = yield* issueAuthCode({
        clientId,
        userId,
        redirectUri,
        scope,
        codeChallenge,
        codeChallengeMethod: codeChallenge ? 'S256' : undefined,
      });

      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('code', code);
      if (params.state) redirectUrl.searchParams.set('state', params.state);
      return { redirectUrl: redirectUrl.toString() };
    });
  },

  /** ===== 管理员：接入应用管理 ===== */

  /** 列出全部接入应用（管理员） */
  listClients() {
    return Effect.gen(function* () {
      yield* requireAdmin();
      const dbClient = yield* DbClientEffect;
      const clients = yield* dbTry(LOG_PREFIX, '列出接入应用', () =>
        dbClient.oAuthClient.findMany({ orderBy: { id: 'desc' } }),
      );
      return clients.map((c) => ({
        id: c.id,
        clientId: c.clientId,
        name: c.name,
        homepage: c.homepage ?? null,
        redirectUris: parseRedirectUris(c),
        disabled: c.disabled,
        created: c.created,
      }));
    });
  },

  /** 注册接入应用：返回明文 clientSecret（仅此一次） */
  createClient(params: { name: string; homepage?: string; redirectUris: string[] }) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      const auth = yield* AuthContext;
      const admin = auth.user;
      if (!params.name?.trim()) return yield* fail('应用名称不能为空');
      const uris = sanitizeRedirectUris(params.redirectUris);
      if (!uris) return yield* fail('redirectUris 必须是非空的 http(s) 地址数组');
      if (params.homepage && !isValidRedirectUri(params.homepage)) return yield* fail('homepage 必须是 http(s) 地址');

      const dbClient = yield* DbClientEffect;
      const clientSecret = generateClientSecret();
      const clientSecretHash = yield* hashPassword(clientSecret);
      const client = yield* dbTry(LOG_PREFIX, '创建接入应用', () =>
        dbClient.oAuthClient.create({
          data: {
            clientId: generateClientId(),
            clientSecretHash,
            name: params.name.trim(),
            homepage: params.homepage?.trim() || null,
            redirectUris: uris as unknown as JsonValue,
            createdBy: admin.id,
          },
        }),
      );
      return {
        id: client.id,
        clientId: client.clientId,
        /** 明文 secret 只在创建响应中出现一次 */
        clientSecret,
        name: client.name,
      };
    });
  },

  /** 启用/禁用接入应用 */
  setClientDisabled(params: { id: number; disabled: boolean }) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      const dbClient = yield* DbClientEffect;
      yield* dbTry(LOG_PREFIX, '更新接入应用状态', () =>
        dbClient.oAuthClient.update({ where: { id: params.id }, data: { disabled: params.disabled } }),
      );
      return { ok: true };
    });
  },

  /** 删除接入应用 */
  deleteClient(id: number) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      const dbClient = yield* DbClientEffect;
      yield* dbTry(LOG_PREFIX, '删除接入应用', () => dbClient.oAuthClient.delete({ where: { id } }));
      return { ok: true };
    });
  },
};
