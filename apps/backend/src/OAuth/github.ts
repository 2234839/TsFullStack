// ===== 常量定义 =====

// 定义默认权限范围
const DEFAULT_SCOPES = ['read:user', 'user:email'] as const;

// API URLs
const GITHUB_OAUTH_URL = 'https://github.com/login/oauth';
const GITHUB_API_URL = 'https://api.github.com';

// Import proxy utilities
import { Context, Effect, Layer } from 'effect';
import { FetchWithProxy } from '../util/github-proxy';
import { AppConfigService } from '../Context/AppConfig';

// ===== 接口定义 =====

/**
 * GitHub OAuth 应用配置
 */
export interface GitHubAuthConfig {
  /** GitHub OAuth App 的 Client ID */
  clientId: string;
  /** GitHub OAuth App 的 Client Secret (仅在服务器端使用) */
  clientSecret?: string;
  /** 授权后的回调 URL */
  redirectUri: string;
  /** 请求的权限范围 */
  scope?: readonly string[];
}

/**
 * 服务器端 GitHub 认证配置
 */
export interface ServerGitHubAuthConfig extends GitHubAuthConfig {
  /** GitHub OAuth App 的 Client Secret (必需) */
  clientSecret: string;
}

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

/**
 * OAuth 令牌响应
 */
export interface TokenResponse {
  /** 访问令牌 */
  accessToken: string;
  /** 令牌类型 */
  tokenType: string;
  /** 权限范围 */
  scope: string;
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

// Effect error type
export type GitHubAuthErrorType = GitHubAuthError | Error;

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
  if (!config) throw new Error('未配置 OAuth_github');
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
        try: () => response.json() as Promise<any>,
        catch: () => new GitHubAuthError('Failed to parse response', GitHubAuthErrorCode.API_ERROR),
      });

      if (data.error) {
        yield* Effect.fail(
          new GitHubAuthError(
            data.error_description || 'Failed to get access token',
            GitHubAuthErrorCode.API_ERROR,
            response.status,
          ),
        );
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
      }

      const data = yield* Effect.tryPromise({
        try: () => response.json() as Promise<any>,
        catch: () => new GitHubAuthError('Failed to parse response', GitHubAuthErrorCode.API_ERROR),
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