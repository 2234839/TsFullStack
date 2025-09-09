import { Effect } from 'effect';
import { AppConfigService } from '../Context/AppConfig';
import { ReqCtxService } from '../Context/ReqCtx';

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

        ctx.log(`fetch proxy, githubProxyUrl:${githubProxyUrl}  targetUrl:${url}`);
        // If proxy is not configured or explicitly disabled, use direct fetch
        if (!useProxy || !githubProxyUrl) {
          return yield* Effect.promise(() => fetch(url, fetchOptions));
        }

        // Use proxy for GitHub API calls
        const urlString = url.toString();

        // Check if this is a GitHub API call
        if (urlString.includes('api.github.com') || urlString.includes('github.com')) {
          return yield* fetchWithPostProxy(urlString, fetchOptions, githubProxyUrl);
        }

        // For non-GitHub URLs, use direct fetch
        return yield* Effect.promise(() => fetch(url, fetchOptions));
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

        console.log('[github-proxy] using POST proxy for:', urlString);

        try {
          return yield* Effect.promise(() =>
            fetch(proxyUrl, {
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
            }),
          );
        } catch (error) {
          console.warn('Proxy request failed, falling back to direct fetch:', error);
          return yield* Effect.promise(() => fetch(urlString, fetchOptions));
        }
      });
    }
    return { fetchProxy } as const;
  }),
  dependencies: [],
}) {}
FetchWithProxy.Default;
