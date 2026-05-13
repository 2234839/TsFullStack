import { Context, Effect, Layer } from 'effect';
import { AppConfigService } from '../Context/AppConfig';
import { fail, tryOrFail } from '../util/error';
import { MSG } from '../util/constants';
import { FetchWithProxy } from '../util/github-proxy';
import { withFetchTimeout, FETCH_TIMEOUTS } from '../util/http';
import { JSON_CONTENT_HEADERS } from '../util/constants';

/** ===== 常量定义 ===== */

/** 浏览器端授权跳转用 connect.linux.do（用户浏览器可以正常访问） */
const LINUXDO_OAUTH_URL = 'https://connect.linux.do/oauth2';
/**
 * 服务端 API 请求用 connect.linuxdo.org（备用域名，避免 Cloudflare 拦截）
 * 参考: https://linux.do/t/topic/1144530
 */
const LINUXDO_API_BASE = 'https://connect.linuxdo.org';

/** ===== 接口定义 ===== */

/** LINUX DO 用户信息 */
export interface LinuxDoUser {
  /** 用户 ID */
  id: number;
  /** 用户名 */
  username: string;
  /** 显示名称 */
  name: string;
  /** 头像 URL */
  avatar_url: string;
  /** 是否活跃 */
  active: boolean;
  /** 信任等级 0-4 */
  trust_level: number;
  /** 是否被禁言 */
  silenced: boolean;
}

/** LINUX DO token API 响应 */
interface LinuxDoTokenResponse {
  access_token: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/** ===== 主要类实现 ===== */
export class LinuxDoAuthService extends Context.Tag('LinuxDoAuthService')<
  LinuxDoAuthService,
  {
    readonly authenticate: (code: string) => Effect.Effect<
      { user: LinuxDoUser; accessToken: string },
      Error
    >;
    readonly getAuthorizationUrl: () => Effect.Effect<string>;
  }
>() {}

const LinuxDoAuthLiveEffect = Effect.gen(function* () {
  const appConfig = yield* AppConfigService;
  const config = appConfig.OAuth_linuxdo;
  if (!config) {
    return yield* fail(MSG.OAUTH_LINUXDO_NOT_CONFIGURED);
  }
  const { fetchProxy } = yield* FetchWithProxy;

  /** 通过代理发起请求（国内服务器无法直接访问 connect.linuxdo.org） */
  const proxyFetch = (url: string, options: RequestInit) => {
    const proxyUrl = appConfig.ApiProxy.github;
    if (!proxyUrl) {
      return tryOrFail('LINUX DO fetch', () => fetch(url, withFetchTimeout(options, FETCH_TIMEOUTS.github)));
    }
    return Effect.gen(function* () {
      const target = new URL(proxyUrl);
      target.pathname = '/proxy';
      const response = yield* tryOrFail('LINUX DO 代理请求', () =>
        fetch(target, withFetchTimeout({
          method: 'POST',
          headers: JSON_CONTENT_HEADERS,
          body: JSON.stringify({
            url,
            method: options.method ?? 'GET',
            headers: Object.fromEntries(
              Object.entries(options.headers ?? {}).filter(([_, v]) => v !== undefined),
            ),
            body: typeof options.body === 'string' ? options.body : undefined,
          }),
        }, FETCH_TIMEOUTS.github)),
      );
      return response;
    });
  };

  const getAccessToken = (code: string) =>
    Effect.gen(function* () {
      if (!code?.trim()) {
        return yield* Effect.fail(new Error('Authorization code is required'));
      }

      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      });

      const response = yield* proxyFetch(`${LINUXDO_API_BASE}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      const data = yield* tryOrFail('解析 LINUX DO token 响应', () =>
        response.json() as Promise<LinuxDoTokenResponse>,
      );

      if (data.error) {
        return yield* Effect.fail(
          new Error(data.error_description || `获取 token 失败: ${data.error}`),
        );
      }

      return data.access_token;
    });

  const getUser = (accessToken: string) =>
    Effect.gen(function* () {
      const response = yield* proxyFetch(`${LINUXDO_API_BASE}/api/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return yield* Effect.fail(new Error(`获取用户信息失败: ${response.status}`));
      }

      return yield* tryOrFail('解析 LINUX DO 用户信息', () =>
        response.json() as Promise<LinuxDoUser>,
      );
    });

  return {
    authenticate(code: string) {
      return Effect.gen(function* () {
        const accessToken = yield* getAccessToken(code);
        const user = yield* getUser(accessToken);
        return { user, accessToken };
      });
    },
    getAuthorizationUrl() {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
      });

      return Effect.succeed(`${LINUXDO_OAUTH_URL}/authorize?${params.toString()}`);
    },
  };
});

export const LinuxDoAuthLive = Layer.effect(LinuxDoAuthService, LinuxDoAuthLiveEffect);
