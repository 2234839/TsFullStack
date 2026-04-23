import { Effect } from 'effect';
import { AppConfigService } from '../Context/AppConfig';
import { withFetchTimeout, FETCH_TIMEOUTS } from './http';
import { ReqCtxService } from '../Context/ReqCtx';
import { MsgError } from '../util/error';

/**
 * Enhanced fetch options with proxy support
 */
export interface ProxyFetchOptions extends RequestInit {
  /** Use proxy for this request */
  useProxy?: boolean;
}

export class FetchWithProxy extends Effect.Service<FetchWithProxy>()('FetchWithProxy', {
  effect: Effect.gen(function* () {
    const appConfig = yield* AppConfigService;
    const ctx = yield* ReqCtxService;

    function fetchProxy(url: string | URL, options: ProxyFetchOptions = {}) {
      return Effect.gen(function* () {
        const { useProxy = true, ...fetchOptions } = options;
        const githubProxyUrl = appConfig.ApiProxy.github;

        ctx.log('[github-proxy] fetch proxy, hasProxy=' + !!githubProxyUrl);
        if (!useProxy || !githubProxyUrl) {
          return yield* Effect.tryPromise({
            try: () => fetch(url, withFetchTimeout(fetchOptions, FETCH_TIMEOUTS.github)),
            catch: (e) => MsgError.msg('fetch 失败: ' + String(e)),
          });
        }

        const urlString = url.toString();

        if (urlString.includes('api.github.com') || urlString.includes('github.com')) {
          return yield* fetchWithPostProxy(urlString, fetchOptions, githubProxyUrl);
        }

        return yield* Effect.tryPromise({
          try: () => fetch(url, withFetchTimeout(fetchOptions, FETCH_TIMEOUTS.github)),
          catch: (e) => MsgError.msg('fetch 失败: ' + String(e)),
        });
      });
    }

    /**
     * 使用 POST 代理方式转发 GitHub API 请求
     * 对应 api-proxy 中的 /proxy 端点
     */
    function fetchWithPostProxy(
      urlString: string,
      fetchOptions: RequestInit,
      githubProxyUrl: string,
    ) {
      return Effect.gen(function* () {
        const proxyUrl = new URL(githubProxyUrl);
        proxyUrl.pathname = '/proxy';

        ctx.log('[github-proxy] using POST proxy for GitHub API');

        const proxyRequest = Effect.tryPromise({
          try: () => fetch(proxyUrl, withFetchTimeout({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...fetchOptions.headers,
            },
            body: JSON.stringify({
              url: urlString,
              method: fetchOptions.method || 'GET',
              headers: Object.fromEntries(
                Object.entries(fetchOptions.headers || {}).filter(
                  ([_, value]) => value !== undefined,
                ),
              ),
              body: fetchOptions.body,
            }),
          }, FETCH_TIMEOUTS.github)),
          catch: (e) => MsgError.msg('代理请求失败: ' + String(e)),
        });

        return yield* Effect.orElse(proxyRequest, () =>
          Effect.gen(function* () {
            ctx.log('[github-proxy] fallback to direct fetch');
            return yield* Effect.tryPromise({
              try: () => fetch(urlString, withFetchTimeout(fetchOptions, FETCH_TIMEOUTS.github)),
              catch: (e) => MsgError.msg('fallback fetch 失败: ' + String(e)),
            });
          }),
        );
      });
    }
    return { fetchProxy } as const;
  }),
  dependencies: [],
}) {}
