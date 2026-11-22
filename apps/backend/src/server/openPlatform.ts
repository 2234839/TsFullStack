import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Effect } from 'effect';
import { AppConfigService, type AppConfig } from '../Context/AppConfig';
import { DbClientEffect, type DbClient } from '../Context/DbService';
import { KVStore, localKVStore } from '../Context/KVStore';
import { comparePassword } from '../util/crypto';
import { extractErrorMessage } from '../util/error';
import { findClient, redirectUriAllowed } from '../OpenPlatform/clients';
import {
  consumeAuthCode,
  extractBearerToken,
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  resolveAccessToken,
  revokeToken,
  verifyPkce,
} from '../OpenPlatform/service';

/** 日志前缀 */
const LOG_PREFIX = '[OpenPlatform]';

/** 为无登录态的服务端到端点构建 db 客户端（无权限检查客户端，仅查询 OAuthClient/User 元数据） */
async function withDb<T>(appConfig: AppConfig, f: (db: DbClient) => Promise<T>): Promise<T> {
  const db = await Effect.runPromise(Effect.provideService(DbClientEffect, AppConfigService, appConfig));
  return f(db);
}

/** KVStore 程序运行辅助：provide 后 runPromise */
async function runKV<T>(program: Effect.Effect<T, never, KVStore>): Promise<T> {
  return Effect.runPromise(Effect.provideService(program, KVStore, localKVStore));
}

/** OAuth 错误响应（RFC 6749 格式） */
function oauthError(reply: FastifyReply, status: number, error: string, description: string) {
  return reply.code(status).send({ error, error_description: description });
}

/** token 响应体（RFC 6749 格式） */
interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
  /** 刷新令牌（轮换语义：每次刷新旧值作废） */
  refresh_token: string;
}

/**
 * 注册开放平台路由：其他网站用本站账号登录的标准 OAuth2 授权码流程端点。
 * authorize 阶段由前端授权确认页（/oauth/consent）承担，此处只做机器到机器的 token 与 userinfo。
 */
export function registerOpenPlatformRoutes(fastify: FastifyInstance, appConfig: AppConfig) {
  /** 授权码换 token / refresh_token 刷新：接入方后端调用（client_secret 校验客户端身份） */
  fastify.post('/oauth/token', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
    const clientId = typeof body.client_id === 'string' ? body.client_id : '';
    const clientSecret = typeof body.client_secret === 'string' ? body.client_secret : '';
    const grantType = typeof body.grant_type === 'string' ? body.grant_type : '';
    const code = typeof body.code === 'string' ? body.code : '';
    const redirectUri = typeof body.redirect_uri === 'string' ? body.redirect_uri : '';
    const codeVerifier = typeof body.code_verifier === 'string' ? body.code_verifier : undefined;
    const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : '';

    if (!clientId) {
      return oauthError(reply, 400, 'invalid_request', '缺少 client_id');
    }
    if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
      return oauthError(reply, 400, 'unsupported_grant_type', '仅支持 authorization_code / refresh_token');
    }

    try {
      const client = await withDb(appConfig, (db) => findClient(db, clientId));
      /** 不区分「应用不存在/secret 错/已禁用」，统一 invalid_client（防探测） */
      if (!client || client.disabled) {
        return oauthError(reply, 401, 'invalid_client', '客户端无效或已禁用');
      }
      const secretOk = await Effect.runPromise(comparePassword(clientSecret, client.clientSecretHash));
      if (!secretOk) {
        return oauthError(reply, 401, 'invalid_client', '客户端无效或已禁用');
      }

      /** ===== refresh_token 刷新：轮换旧值，发新对 ===== */
      if (grantType === 'refresh_token') {
        if (!refreshToken) {
          return oauthError(reply, 400, 'invalid_request', '缺少 refresh_token');
        }
        const rotated = await runKV(rotateRefreshToken(refreshToken, clientId));
        if (!rotated) {
          return oauthError(reply, 400, 'invalid_grant', 'refresh_token 无效或已轮换');
        }
        const accessToken = await runKV(issueAccessToken(rotated.userId, rotated.scope));
        const newRefresh = await runKV(issueRefreshToken(rotated.userId, rotated.scope, clientId));
        const res: TokenResponse = {
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 14 * 24 * 60 * 60,
          scope: rotated.scope,
          refresh_token: newRefresh,
        };
        reply.header('cache-control', 'no-store');
        reply.header('pragma', 'no-cache');
        return res;
      }

      /** ===== authorization_code 兑换 ===== */
      if (!code || !redirectUri) {
        return oauthError(reply, 400, 'invalid_request', '缺少 code/redirect_uri');
      }
      if (!redirectUriAllowed(client, redirectUri)) {
        return oauthError(reply, 400, 'invalid_grant', 'redirect_uri 与注册列表不匹配');
      }

      const payload = await runKV(consumeAuthCode(code, clientId, redirectUri));
      if (!payload) {
        return oauthError(reply, 400, 'invalid_grant', '授权码无效、已过期或已使用');
      }
      if (!verifyPkce(payload, codeVerifier)) {
        return oauthError(reply, 400, 'invalid_grant', 'PKCE 校验失败');
      }

      const accessToken = await runKV(issueAccessToken(payload.userId, payload.scope));
      const newRefresh = await runKV(issueRefreshToken(payload.userId, payload.scope, clientId));
      const res: TokenResponse = {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 14 * 24 * 60 * 60,
        scope: payload.scope,
        refresh_token: newRefresh,
      };
      /** 防接入方缓存凭据 */
      reply.header('cache-control', 'no-store');
      reply.header('pragma', 'no-cache');
      return res;
    } catch (e) {
      console.error(`${LOG_PREFIX} token 兑换失败: ${extractErrorMessage(e)}`);
      return oauthError(reply, 500, 'server_error', '服务端内部错误');
    }
  });

  /** token 撤销（RFC 7009）：接入方登出/用户解绑时吊销 access/refresh token */
  fastify.post('/oauth/revoke', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
    const clientId = typeof body.client_id === 'string' ? body.client_id : '';
    const clientSecret = typeof body.client_secret === 'string' ? body.client_secret : '';
    const token = typeof body.token === 'string' ? body.token : '';
    if (!clientId || !clientSecret || !token) {
      return oauthError(reply, 400, 'invalid_request', '缺少 client_id/client_secret/token');
    }
    try {
      const client = await withDb(appConfig, (db) => findClient(db, clientId));
      if (!client || client.disabled) {
        return oauthError(reply, 401, 'invalid_client', '客户端无效或已禁用');
      }
      const secretOk = await Effect.runPromise(comparePassword(clientSecret, client.clientSecretHash));
      if (!secretOk) {
        return oauthError(reply, 401, 'invalid_client', '客户端无效或已禁用');
      }
      await runKV(revokeToken(token));
      return { revoked: true };
    } catch (e) {
      console.error(`${LOG_PREFIX} revoke 失败: ${extractErrorMessage(e)}`);
      return oauthError(reply, 500, 'server_error', '服务端内部错误');
    }
  });

  /** 用户信息端点：接入方后端持 Bearer access_token 调用 */
  fastify.get('/oauth/userinfo', async (req: FastifyRequest, reply: FastifyReply) => {
    const token = extractBearerToken(req.headers.authorization);
    const session = await runKV(resolveAccessToken(token));
    if (!session) {
      return oauthError(reply, 401, 'invalid_token', 'access_token 无效或已过期');
    }
    try {
      const user = await withDb(appConfig, (db) => db.user.findFirst({ where: { id: session.userId } }));
      if (!user) {
        return oauthError(reply, 401, 'invalid_token', '用户不存在');
      }
      /** 伪邮箱（@oauth.local）不下发：对外只暴露真实身份字段 */
      const isFakeEmail = user.email.endsWith('@oauth.local');
      return {
        sub: user.id,
        nickname: user.nickname ?? null,
        avatar: user.avatar ?? null,
        email: isFakeEmail ? null : user.email,
      };
    } catch (e) {
      console.error(`${LOG_PREFIX} userinfo 查询失败: ${extractErrorMessage(e)}`);
      return oauthError(reply, 500, 'server_error', '服务端内部错误');
    }
  });
}
