import { Context, Effect, Layer } from 'effect';
import { FetchWithProxy } from '../util/github-proxy';
import { AppConfigService } from '../Context/AppConfig';
import { fail, neverReturn, MsgError } from '../util/error';

// ===== 常量定义 =====

/** GitHub OAuth 默认权限范围 */
const DEFAULT_SCOPES = ['read:user', 'user:email'] as const;

/** GitHub OAuth / API 端点 URL */
const GITHUB_OAUTH_URL = 'https://github.com/login/oauth';
const GITHUB_API_URL = 'https://api.github.com';

// ===== 接口定义 =====

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

// ===== 错误处理 =====

/**
 * 认证错误类型
 */
export enum GitHubAuthErrorCode {
  INVALID_CONFIG = 'INVALID_CONFIG',
  INVALID_CODE = 'INVALID_CODE',
  INVALID_TOKEN = 'INVALID_TOKEN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  REVOKE_ERROR = 'REVOKE_ERROR',
}

/**
 * 认证错误
 */
export class GitHubAuthError extends Error {
  public readonly code: GitHubAuthErrorCode;
  public readonly statusCode?: number;

  constructor(message: string, code: GitHubAuthErrorCode, statusCode?: number) {
    super(message);
    this.name = 'GitHubAuthError';
    this.code = code;
    this.statusCode = statusCode;

    // 确保原型链正确设置
    Object.setPrototypeOf(this, GitHubAuthError.prototype);
  }
}

// ===== 主要类实现 =====
export class GithubAuthService extends Context.Tag('GithubAuthService')<
  GithubAuthService,
  {
    readonly authenticate: (code: string) => Effect.Effect<
      {
        user: GitHubUser;
        accessToken: string;
      },
      GitHubAuthError
    >;
    readonly getAuthorizationUrl: (state?: string | undefined) => Effect.Effect<string>;
  }
>() {}

export const GithubAuthLiveEffect = Effect.gen(function* () {
  const appConfig = yield* AppConfigService;
  const config = appConfig.OAuth_github;
  if (!config) {
      yield* Effect.fail(new MsgError(MsgError.op_msgError, '未配置 OAuth_github'));
      return neverReturn();
    }
  const { fetchProxy } = yield* FetchWithProxy;
  const getAccessToken = (code: string) => {
    if (!config.clientSecret) {
      return Effect.fail(
        new GitHubAuthError(
          'Client secret is required for token exchange',
          GitHubAuthErrorCode.INVALID_CONFIG,
        ),
      );
    }

    return Effect.gen(function* () {
      if (!code?.trim()) {
        yield* Effect.fail(
          new GitHubAuthError('Authorization code is required', GitHubAuthErrorCode.INVALID_CODE),
        );
        return neverReturn();
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
        catch: () => { return new GitHubAuthError('Failed to parse response', GitHubAuthErrorCode.API_ERROR); },
      });

      if (data.error) {
        yield* Effect.fail(
          new GitHubAuthError(
            data.error_description || `Failed to get access token: ${data.error}`,
            GitHubAuthErrorCode.API_ERROR,
            response.status,
          ),
        );
        return neverReturn();
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type || 'bearer',
        scope: data.scope || '',
      };
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          error instanceof GitHubAuthError
            ? error
            : new GitHubAuthError('Network request failed', GitHubAuthErrorCode.NETWORK_ERROR),
        ),
      ),
    );
  };
  const getUser = (accessToken: string) =>
    Effect.gen(function* () {
      if (!accessToken?.trim()) {
        yield* Effect.fail(
          new GitHubAuthError('Access token is required', GitHubAuthErrorCode.INVALID_TOKEN),
        );
        return neverReturn();
      }

      const response = yield* fetchProxy(`${GITHUB_API_URL}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        yield* Effect.fail(
          new GitHubAuthError(
            'Failed to get user information',
            GitHubAuthErrorCode.API_ERROR,
            response.status,
          ),
        );
        return neverReturn();
      }

      const data = yield* Effect.tryPromise({
        try: () => response.json() as Promise<GitHubUserApiResponse>,
        catch: () => { return new GitHubAuthError('Failed to parse response', GitHubAuthErrorCode.API_ERROR); },
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
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          error instanceof GitHubAuthError
            ? error
            : new GitHubAuthError('Network request failed', GitHubAuthErrorCode.NETWORK_ERROR),
        ),
      ),
    );
  return {
    authenticate(code: string) {
      return getAccessToken(code).pipe(
        Effect.andThen((tokenResponse) =>
          getUser(tokenResponse.accessToken).pipe(
            Effect.map((user) => ({ user, accessToken: tokenResponse.accessToken })),
          ),
        ),
      );
    },
    getAuthorizationUrl: (state?: string) => {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: (config.scope || DEFAULT_SCOPES).join(' '),
      });

      if (state) {
        params.append('state', state);
      }

      return Effect.succeed(`${GITHUB_OAUTH_URL}/authorize?${params.toString()}`);
    },
  };
});
export const GithubAuthLive = Layer.effect(GithubAuthService, GithubAuthLiveEffect);
