import { Context, Effect, Layer } from 'effect';
import { randomBytes } from 'node:crypto';
import { FetchWithProxy } from '../util/github-proxy';
import { AppConfigService } from '../Context/AppConfig';
import { fail } from '../util/error';
import { MSG } from '../util/constants';

/** ===== OAuth state CSRF 防护 ===== */

/** state 有效期（10 分钟，覆盖正常 OAuth 往返时间） */
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** state 存储上限（防内存膨胀；单实例部署下 10 分钟内不可能积累这么多登录） */
const OAUTH_STATE_MAX_ENTRIES = 10_000;

/** state 登记表：state → 过期时间 + 意图 + 发起者（bind 时防止被诱导绑到他人账号） */
const oauthStates = new Map<
  string,
  { expiresAt: number; intent?: 'login' | 'bind' | 'merge'; initiatorUserId?: string }
>();

/**
 * 登记 state（getAuthorizationUrl 时调用）
 * 超限时淘汰最旧条目；过期条目在读写时顺手清理
 * bind 意图必须携带发起者 userId，回调时校验会话一致，防止诱导绑定（CSRF）
 */
export function registerOAuthState(state: string, intent: OAuthIntent = 'login', initiatorUserId?: string): void {
  const now = Date.now();
  if (oauthStates.size >= OAUTH_STATE_MAX_ENTRIES) {
    /** 淘汰全部已过期项；若仍超限则删除最早插入项 */
    for (const [k, entry] of oauthStates) {
      if (entry.expiresAt < now) oauthStates.delete(k);
    }
    while (oauthStates.size >= OAUTH_STATE_MAX_ENTRIES) {
      const oldest = oauthStates.keys().next().value;
      if (oldest === undefined) break;
      oauthStates.delete(oldest);
    }
  }
  oauthStates.set(state, { expiresAt: now + OAUTH_STATE_TTL_MS, intent, initiatorUserId });
}

/** OAuth 回调意图：login 登录 / bind 绑定到当前账号 / merge 验证被合并账号身份 */
export type OAuthIntent = 'login' | 'bind' | 'merge';

/**
 * 消费 state 并返回详情（authenticate 时调用，一次性防重放）
 * @returns valid = state 有效且未过期；intent = 发起时的意图；initiatorUserId = bind 发起者
 */
export function consumeOAuthStateDetail(state: string | undefined): {
  valid: boolean;
  bind: boolean;
  intent: OAuthIntent;
  initiatorUserId?: string;
} {
  if (!state) return { valid: false, bind: false, intent: 'login' };
  const entry = oauthStates.get(state);
  oauthStates.delete(state);
  if (!entry) return { valid: false, bind: false, intent: 'login' };
  const valid = Date.now() <= entry.expiresAt;
  return {
    valid,
    bind: entry.intent === 'bind',
    intent: valid ? (entry.intent ?? 'login') : 'login',
    initiatorUserId: entry.initiatorUserId,
  };
}

/**
 * 消费 state（兼容旧调用：仅判断有效性）
 */
export function consumeOAuthState(state: string | undefined): boolean {
  return consumeOAuthStateDetail(state).valid;
}

/** ===== 常量定义 ===== */

/** GitHub OAuth 默认权限范围 */
const DEFAULT_SCOPES = ['read:user', 'user:email'] as const;

/** GitHub OAuth / API 端点 URL */
const GITHUB_OAUTH_URL = 'https://github.com/login/oauth';
const GITHUB_API_URL = 'https://api.github.com';

/** ===== 接口定义 ===== */

/**
 * GitHub 用户信息
 */
export interface GitHubUser {
  /** 用户 ID */
  id: number;
  /** 用户名 */
  login: string;
  /** 显示名称 */
  name: string | null;
  /** 邮箱地址 */
  email: string | null;
  /** 头像 URL */
  avatarUrl: string;
  /** 个人主页 URL */
  htmlUrl: string;
  /** 个人简介 */
  bio: string | null;
  /** 公司信息 */
  company: string | null;
  /** 位置信息 */
  location: string | null;
  /** 公开仓库数量 */
  publicRepos: number;
  /** 关注者数量 */
  followers: number;
  /** 关注数量 */
  following: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** GitHub access_token API 响应结构 */
interface GitHubTokenApiResponse {
  access_token: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/** GitHub /user API 响应结构 */
interface GitHubUserApiResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

/** ===== 错误处理 ===== */

/**
 * 认证错误类型
 */
enum GitHubAuthErrorCode {
  INVALID_CONFIG = 'INVALID_CONFIG',
  INVALID_CODE = 'INVALID_CODE',
  INVALID_TOKEN = 'INVALID_TOKEN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  REVOKE_ERROR = 'REVOKE_ERROR',
  /** OAuth state 校验失败（CSRF） */
  INVALID_STATE = 'INVALID_STATE',
}

/**
 * 认证错误
 */
class GitHubAuthError extends Error {
  public readonly code: GitHubAuthErrorCode;
  public readonly statusCode?: number;

  constructor(message: string, code: GitHubAuthErrorCode, statusCode?: number) {
    super(message);
    this.name = 'GitHubAuthError';
    this.code = code;
    this.statusCode = statusCode;

    /** 确保原型链正确设置 */
    Object.setPrototypeOf(this, GitHubAuthError.prototype);
  }
}

/** JSON 响应解析失败时统一构造错误（消除重复的 catch 回调） */
const parseResponseError = () => new GitHubAuthError('Failed to parse response', GitHubAuthErrorCode.API_ERROR);

/** 将未知错误统一映射为 NETWORK_ERROR（消除重复的 mapError 管道） */
const catchNetworkError = Effect.mapError((error: unknown) =>
  error instanceof GitHubAuthError
    ? error
    : Object.assign(new GitHubAuthError('Network request failed', GitHubAuthErrorCode.NETWORK_ERROR), { cause: error }),
);

/** ===== 主要类实现 ===== */
export class GithubAuthService extends Context.Service<
  GithubAuthService,
  {
    readonly authenticate: (
      code: string,
      state?: string,
    ) => Effect.Effect<
      {
        user: GitHubUser;
        accessToken: string;
        /** 发起时是否为绑定意图（state 标记回传） */
        bind: boolean;
        /** 发起时的意图（login/bind/merge） */
        intent: OAuthIntent;
        /** bind 发起者（state 记录回传，回调校验会话一致） */
        initiatorUserId?: string;
      },
      GitHubAuthError
    >;
    readonly getAuthorizationUrl: (intent?: OAuthIntent, initiatorUserId?: string) => Effect.Effect<string>;
  }
>()('GithubAuthService') {}

const GithubAuthLiveEffect = Effect.gen(function* () {
  const appConfig = yield* AppConfigService;
  const config = appConfig.OAuth_github;
  if (!config) {
    return yield* fail(MSG.OAUTH_GITHUB_NOT_CONFIGURED);
  }
  const { fetchProxy } = yield* FetchWithProxy;
  const getAccessToken = (code: string) => {
    if (!config.clientSecret) {
      return Effect.fail(
        new GitHubAuthError('Client secret is required for token exchange', GitHubAuthErrorCode.INVALID_CONFIG),
      );
    }

    return Effect.gen(function* () {
      if (!code?.trim()) {
        return yield* Effect.fail(
          new GitHubAuthError('Authorization code is required', GitHubAuthErrorCode.INVALID_CODE),
        );
      }

      const response = yield* fetchProxy(`${GITHUB_OAUTH_URL}/access_token`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
        }),
      });

      const data = yield* Effect.tryPromise({
        try: () => response.json() as Promise<GitHubTokenApiResponse>,
        catch: parseResponseError,
      });

      if (data.error) {
        return yield* Effect.fail(
          new GitHubAuthError(
            data.error_description || `Failed to get access token: ${data.error}`,
            GitHubAuthErrorCode.API_ERROR,
            response.status,
          ),
        );
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type ?? 'bearer',
        scope: data.scope ?? '',
      };
    }).pipe(catchNetworkError);
  };
  const getUser = (accessToken: string) =>
    Effect.gen(function* () {
      if (!accessToken?.trim()) {
        return yield* Effect.fail(new GitHubAuthError('Access token is required', GitHubAuthErrorCode.INVALID_TOKEN));
      }

      const response = yield* fetchProxy(`${GITHUB_API_URL}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        return yield* Effect.fail(
          new GitHubAuthError('Failed to get user information', GitHubAuthErrorCode.API_ERROR, response.status),
        );
      }

      const data = yield* Effect.tryPromise({
        try: () => response.json() as Promise<GitHubUserApiResponse>,
        catch: parseResponseError,
      });

      return {
        id: data.id,
        login: data.login,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
        htmlUrl: data.html_url,
        bio: data.bio,
        company: data.company,
        location: data.location,
        publicRepos: data.public_repos,
        followers: data.followers,
        following: data.following,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      } satisfies GitHubUser;
    }).pipe(catchNetworkError);
  return {
    authenticate(code: string, state?: string) {
      return Effect.gen(function* () {
        /** CSRF 防护：state 必须是本服务签发且未被使用过的（一次性消费防重放）；bind = 发起时绑定意图 */
        const stateDetail = consumeOAuthStateDetail(state);
        if (!stateDetail.valid) {
          return yield* Effect.fail(
            new GitHubAuthError('Invalid or expired OAuth state', GitHubAuthErrorCode.INVALID_STATE),
          );
        }
        const tokenResponse = yield* getAccessToken(code);
        const user = yield* getUser(tokenResponse.accessToken);
        return {
          user,
          accessToken: tokenResponse.accessToken,
          bind: stateDetail.bind,
          intent: stateDetail.intent,
          initiatorUserId: stateDetail.initiatorUserId,
        };
      });
    },
    getAuthorizationUrl: (intent: OAuthIntent = 'login', initiatorUserId?: string) => {
      /** 服务端签发随机 state 并登记（intent 标记登录/绑定/合并验证意图；bind 记录发起者），回调时验证（防 CSRF 登录劫持） */
      const state = randomBytes(16).toString('hex');
      registerOAuthState(state, intent, intent === 'bind' ? initiatorUserId : undefined);
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: (config.scope ?? DEFAULT_SCOPES).join(' '),
        state,
      });

      return Effect.succeed(`${GITHUB_OAUTH_URL}/authorize?${params.toString()}`);
    },
  };
});
export const GithubAuthLive = Layer.effect(GithubAuthService, GithubAuthLiveEffect);
