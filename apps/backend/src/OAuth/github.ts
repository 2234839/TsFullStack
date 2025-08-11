/**
 * @fileoverview GitHub OAuth Authentication Client
 * @author Your Name
 * @license MIT
 */

// ===== 常量定义 =====

// 定义默认权限范围
const DEFAULT_SCOPES = ["read:user", "user:email"] as const

// API URLs
const GITHUB_OAUTH_URL = "https://github.com/login/oauth"
const GITHUB_API_URL = "https://api.github.com"

// Import proxy utilities
import { fetchWithProxy } from '../util/github-proxy';
import { Effect, Either } from 'effect';

// ===== 接口定义 =====

/**
 * GitHub OAuth 应用配置
 */
export interface GitHubAuthConfig {
  /** GitHub OAuth App 的 Client ID */
  clientId: string
  /** GitHub OAuth App 的 Client Secret (仅在服务器端使用) */
  clientSecret?: string
  /** 授权后的回调 URL */
  redirectUri: string
  /** 请求的权限范围 */
  scope?: readonly string[]
}

/**
 * 服务器端 GitHub 认证配置
 */
export interface ServerGitHubAuthConfig extends GitHubAuthConfig {
  /** GitHub OAuth App 的 Client Secret (必需) */
  clientSecret: string
}

/**
 * GitHub 用户信息
 */
export interface GitHubUser {
  /** 用户 ID */
  id: number
  /** 用户名 */
  login: string
  /** 显示名称 */
  name: string | null
  /** 邮箱地址 */
  email: string | null
  /** 头像 URL */
  avatarUrl: string
  /** 个人主页 URL */
  htmlUrl: string
  /** 个人简介 */
  bio: string | null
  /** 公司信息 */
  company: string | null
  /** 位置信息 */
  location: string | null
  /** 公开仓库数量 */
  publicRepos: number
  /** 关注者数量 */
  followers: number
  /** 关注数量 */
  following: number
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * OAuth 令牌响应
 */
export interface TokenResponse {
  /** 访问令牌 */
  accessToken: string
  /** 令牌类型 */
  tokenType: string
  /** 权限范围 */
  scope: string
}

// ===== 错误处理 =====

/**
 * 认证错误类型
 */
export enum GitHubAuthErrorCode {
  INVALID_CONFIG = "INVALID_CONFIG",
  INVALID_CODE = "INVALID_CODE",
  INVALID_TOKEN = "INVALID_TOKEN",
  NETWORK_ERROR = "NETWORK_ERROR",
  API_ERROR = "API_ERROR",
  REVOKE_ERROR = "REVOKE_ERROR",
}

/**
 * 认证错误
 */
export class GitHubAuthError extends Error {
  public readonly code: GitHubAuthErrorCode
  public readonly statusCode?: number

  constructor(message: string, code: GitHubAuthErrorCode, statusCode?: number) {
    super(message)
    this.name = "GitHubAuthError"
    this.code = code
    this.statusCode = statusCode

    // 确保原型链正确设置
    Object.setPrototypeOf(this, GitHubAuthError.prototype)
  }
}

// Effect error type
export type GitHubAuthErrorType = GitHubAuthError | Error

// Effect tag for GitHub Auth service
export class GitHubAuthService extends Effect.Tag('GitHubAuthService')<
  GitHubAuthService,
  {
    readonly validateConfig: (config: GitHubAuthConfig) => Effect.Effect<void, GitHubAuthError>
    readonly getAccessToken: (code: string) => Effect.Effect<TokenResponse, GitHubAuthError>
    readonly getUser: (accessToken: string) => Effect.Effect<GitHubUser, GitHubAuthError>
    readonly authenticate: (code: string) => Effect.Effect<{ user: GitHubUser; accessToken: string }, GitHubAuthError>
    readonly verifyToken: (accessToken: string) => Effect.Effect<boolean, GitHubAuthError>
    readonly revokeToken: (accessToken: string) => Effect.Effect<void, GitHubAuthError>
    readonly getAuthorizationUrl: (state?: string) => Effect.Effect<string, GitHubAuthError>
  }
>() {}

// ===== 主要类实现 =====

/**
 * GitHub 认证客户端
 * 提供 GitHub OAuth 认证的完整流程支持
 *
 * @example
 * ```typescript
 * const auth = new GitHubAuth({
 *   clientId: 'your-client-id',
 *   redirectUri: 'https://your-app.com/callback'
 * });
 *
 * // 获取授权 URL
 * const authUrl = auth.getAuthorizationUrl();
 * ```
 */
export class GitHubAuth {
  protected readonly config: Required<GitHubAuthConfig>

  constructor(config: GitHubAuthConfig) {
    this.config = {
      ...config,
      clientSecret: config.clientSecret || "",
      scope: config.scope || DEFAULT_SCOPES,
    }
  }


  /**
   * 获取授权 URL
   * @param state - 可选的状态参数，用于防止 CSRF 攻击
   * @returns Effect that returns GitHub 授权页面 URL
   */
  getAuthorizationUrl(state?: string): Effect.Effect<string, GitHubAuthError> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope.join(" "),
    })

    if (state) {
      params.append("state", state)
    }

    return Effect.succeed(`${GITHUB_OAUTH_URL}/authorize?${params.toString()}`)
  }

  /**
   * 使用授权码交换访问令牌（仅服务器端）
   * @param code - GitHub 返回的授权码
   * @returns Effect that returns 访问令牌信息
   */
  getAccessToken(code: string): Effect.Effect<TokenResponse, GitHubAuthError> {
    const config = this.config
    return Effect.gen(function* () {
      if (!code?.trim()) {
        yield* Effect.fail(new GitHubAuthError("Authorization code is required", GitHubAuthErrorCode.INVALID_CODE))
      }

      if (!config.clientSecret) {
        yield* Effect.fail(new GitHubAuthError("Client secret is required for token exchange", GitHubAuthErrorCode.INVALID_CONFIG))
      }

      const response = yield* Effect.promise(() =>
        fetch(`${GITHUB_OAUTH_URL}/access_token`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.redirectUri,
          }),
        })
      )

      const data = yield* Effect.tryPromise({
        try: () => response.json() as Promise<any>,
        catch: () => new GitHubAuthError("Failed to parse response", GitHubAuthErrorCode.API_ERROR)
      })

      if (data.error) {
        yield* Effect.fail(new GitHubAuthError(
          data.error_description || "Failed to get access token",
          GitHubAuthErrorCode.API_ERROR,
          response.status,
        ))
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type || "bearer",
        scope: data.scope || "",
      }
    }).pipe(Effect.catchAll((error) =>
      Effect.fail(error instanceof GitHubAuthError ? error : new GitHubAuthError("Network request failed", GitHubAuthErrorCode.NETWORK_ERROR))
    ))
  }

  /**
   * 获取用户信息
   * @param accessToken - 访问令牌
   * @returns Effect that returns GitHub 用户信息
   */
  getUser(accessToken: string): Effect.Effect<GitHubUser, GitHubAuthError> {
    return Effect.gen(function* () {
      if (!accessToken?.trim()) {
        yield* Effect.fail(new GitHubAuthError("Access token is required", GitHubAuthErrorCode.INVALID_TOKEN))
      }

      const response = yield* Effect.promise(() =>
        fetch(`${GITHUB_API_URL}/user`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        })
      )

      if (!response.ok) {
        yield* Effect.fail(new GitHubAuthError("Failed to get user information", GitHubAuthErrorCode.API_ERROR, response.status))
      }

      const data = yield* Effect.tryPromise({
        try: () => response.json() as Promise<any>,
        catch: () => new GitHubAuthError("Failed to parse response", GitHubAuthErrorCode.API_ERROR)
      })

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
      }
    }).pipe(Effect.catchAll((error) =>
      Effect.fail(error instanceof GitHubAuthError ? error : new GitHubAuthError("Network request failed", GitHubAuthErrorCode.NETWORK_ERROR))
    ))
  }

  /**
   * 完整的认证流程（仅服务器端）
   * @param code - GitHub 返回的授权码
   * @returns Effect that returns 用户信息和访问令牌
   */
  authenticate(code: string): Effect.Effect<{
    user: GitHubUser
    accessToken: string
  }, GitHubAuthError> {
    const getAccessToken = this.getAccessToken.bind(this)
    const getUser = this.getUser.bind(this)

    return Effect.gen(function* () {
      const tokenResponse = yield* getAccessToken(code)
      const user = yield* getUser(tokenResponse.accessToken)

      return { user, accessToken: tokenResponse.accessToken }
    })
  }

  /**
   * 验证访问令牌是否有效
   * @param accessToken - 访问令牌
   * @returns Effect that returns 是否有效
   */
  verifyToken(accessToken: string): Effect.Effect<boolean, GitHubAuthError> {
    const getUser = this.getUser.bind(this)

    return Effect.match(getUser(accessToken), {
      onSuccess: () => true,
      onFailure: () => false
    })
  }

  /**
   * 撤销访问令牌（仅服务器端）
   * @param accessToken - 访问令牌
   * @returns Effect that completes when token is revoked
   */
  revokeToken(accessToken: string): Effect.Effect<void, GitHubAuthError> {
    const config = this.config

    return Effect.gen(function* () {
      if (!config.clientSecret) {
        yield* Effect.fail(new GitHubAuthError("Client secret is required for token revocation", GitHubAuthErrorCode.INVALID_CONFIG))
      }

      // 使用 btoa 替代 Buffer（浏览器兼容）
      const credentials = btoa(`${config.clientId}:${config.clientSecret}`)

      const response = yield* Effect.promise(() =>
        fetch(`${GITHUB_API_URL}/applications/${config.clientId}/token`, {
          method: "DELETE",
          headers: {
            Authorization: `Basic ${credentials}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_token: accessToken,
          }),
        })
      )

      if (!response.ok) {
        yield* Effect.fail(new GitHubAuthError("Failed to revoke token", GitHubAuthErrorCode.REVOKE_ERROR, response.status))
      }
    }).pipe(Effect.catchAll((error) =>
      Effect.fail(error instanceof GitHubAuthError ? error : new GitHubAuthError("Failed to revoke token", GitHubAuthErrorCode.REVOKE_ERROR))
    ))
  }

  /**
   * 生成 CSRF 防护的状态参数
   * @returns 随机生成的状态字符串
   */
  static generateState(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
  }
}

/**
 * 服务器端 GitHub 认证客户端
 * 包含需要 client secret 的敏感操作
 */
export class ServerGitHubAuth extends GitHubAuth {
  constructor(config: ServerGitHubAuthConfig) {
    if (!config.clientSecret?.trim()) {
      throw new GitHubAuthError(
        "Client secret is required for server-side authentication",
        GitHubAuthErrorCode.INVALID_CONFIG,
      )
    }
    super(config)
  }

  /**
   * 创建用于客户端的安全配置
   * @returns 不包含敏感信息的配置
   */
  getClientConfig(): GitHubAuthConfig {
    return {
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      scope: this.config.scope,
    }
  }
}

// Effect service implementation
export const GitHubAuthServiceLive = (config: GitHubAuthConfig) => {
  const getAccessToken = (code: string) => {
    if (!config.clientSecret) {
      return Effect.fail(new GitHubAuthError("Client secret is required for token exchange", GitHubAuthErrorCode.INVALID_CONFIG))
    }

    return Effect.gen(function* () {
      if (!code?.trim()) {
        yield* Effect.fail(new GitHubAuthError("Authorization code is required", GitHubAuthErrorCode.INVALID_CODE))
      }

      const response = yield* Effect.promise(() =>
        fetch(`${GITHUB_OAUTH_URL}/access_token`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.redirectUri,
          }),
        })
      )

      const data = yield* Effect.tryPromise({
        try: () => response.json() as Promise<any>,
        catch: () => new GitHubAuthError("Failed to parse response", GitHubAuthErrorCode.API_ERROR)
      })

      if (data.error) {
        yield* Effect.fail(new GitHubAuthError(
          data.error_description || "Failed to get access token",
          GitHubAuthErrorCode.API_ERROR,
          response.status,
        ))
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type || "bearer",
        scope: data.scope || "",
      }
    }).pipe(Effect.catchAll((error) =>
      Effect.fail(error instanceof GitHubAuthError ? error : new GitHubAuthError("Network request failed", GitHubAuthErrorCode.NETWORK_ERROR))
    ))
  }

  const getUser = (accessToken: string) => Effect.gen(function* () {
    if (!accessToken?.trim()) {
      yield* Effect.fail(new GitHubAuthError("Access token is required", GitHubAuthErrorCode.INVALID_TOKEN))
    }

    const response = yield* Effect.promise(() =>
      fetch(`${GITHUB_API_URL}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      })
    )

    if (!response.ok) {
      yield* Effect.fail(new GitHubAuthError("Failed to get user information", GitHubAuthErrorCode.API_ERROR, response.status))
    }

    const data = yield* Effect.tryPromise({
      try: () => response.json() as Promise<any>,
      catch: () => new GitHubAuthError("Failed to parse response", GitHubAuthErrorCode.API_ERROR)
    })

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
    }
  }).pipe(Effect.catchAll((error) =>
    Effect.fail(error instanceof GitHubAuthError ? error : new GitHubAuthError("Network request failed", GitHubAuthErrorCode.NETWORK_ERROR))
  ))

  const authenticate = (code: string) => {
    return getAccessToken(code).pipe(
      Effect.andThen((tokenResponse) =>
        getUser(tokenResponse.accessToken).pipe(
          Effect.map((user) => ({ user, accessToken: tokenResponse.accessToken }))
        )
      )
    )
  }

  const verifyToken = (accessToken: string) => {
    return Effect.match(getUser(accessToken), {
      onSuccess: () => true,
      onFailure: () => false
    })
  }

  const revokeToken = (accessToken: string) => {
    if (!config.clientSecret) {
      return Effect.fail(new GitHubAuthError("Client secret is required for token revocation", GitHubAuthErrorCode.INVALID_CONFIG))
    }

    return Effect.gen(function* () {
      const credentials = btoa(`${config.clientId}:${config.clientSecret}`)

      const response = yield* Effect.promise(() =>
        fetch(`${GITHUB_API_URL}/applications/${config.clientId}/token`, {
          method: "DELETE",
          headers: {
            Authorization: `Basic ${credentials}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_token: accessToken,
          }),
        })
      )

      if (!response.ok) {
        yield* Effect.fail(new GitHubAuthError("Failed to revoke token", GitHubAuthErrorCode.REVOKE_ERROR, response.status))
      }
    }).pipe(Effect.catchAll((error) =>
      Effect.fail(error instanceof GitHubAuthError ? error : new GitHubAuthError("Failed to revoke token", GitHubAuthErrorCode.REVOKE_ERROR))
    ))
  }

  return GitHubAuthService.of({
    validateConfig: (config: GitHubAuthConfig) => Effect.gen(function* () {
      if (!config.clientId?.trim()) {
        yield* Effect.fail(new GitHubAuthError("Client ID is required", GitHubAuthErrorCode.INVALID_CONFIG))
      }

      if (!config.redirectUri?.trim()) {
        yield* Effect.fail(new GitHubAuthError("Redirect URI is required", GitHubAuthErrorCode.INVALID_CONFIG))
      }

      try {
        new URL(config.redirectUri)
      } catch {
        yield* Effect.fail(new GitHubAuthError("Invalid redirect URI format", GitHubAuthErrorCode.INVALID_CONFIG))
      }
    }),

    getAuthorizationUrl: (state?: string) => {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: (config.scope || DEFAULT_SCOPES).join(" "),
      })

      if (state) {
        params.append("state", state)
      }

      return Effect.succeed(`${GITHUB_OAUTH_URL}/authorize?${params.toString()}`)
    },

    getAccessToken,
    getUser,
    authenticate,
    verifyToken,
    revokeToken
  })
}