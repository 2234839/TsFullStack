import { Effect } from 'effect';
import { AppConfigService } from '../Context/AppConfig';
import { withFetchTimeout, FETCH_TIMEOUTS } from './http';
import { ReqCtxService } from '../Context/ReqCtx';
import { tryOrFail } from '../util/error';
import { JSON_CONTENT_HEADERS } from './constants';

/** 日志前缀 */
const LOG_PREFIX = '[github-proxy]';

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

    /** 直接 fetch（无代理），共用错误处理 */
    function directFetch(url: string | URL, fetchOptions: RequestInit) {
      return tryOrFail('fetch', () => fetch(url, withFetchTimeout(fetchOptions, FETCH_TIMEOUTS.github)));
    }

    function fetchProxy(url: string | URL, options: ProxyFetchOptions = {}) {
      return Effect.gen(function* () {
        const { useProxy = true, ...fetchOptions } = options;
        const githubProxyUrl = appConfig.ApiProxy.github;

        ctx.log(`${LOG_PREFIX} fetch proxy, hasProxy=${!!githubProxyUrl}`);
        if (!useProxy || !githubProxyUrl) {
          return yield* directFetch(url, fetchOptions);
        }

        const urlString = url.toString();

        if (urlString.includes('api.github.com') || urlString.includes('github.com')) {
          return yield* fetchWithPostProxy(urlString, fetchOptions, githubProxyUrl);
        }

        return yield* directFetch(url, fetchOptions);
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

        ctx.log(`${LOG_PREFIX} using POST proxy for GitHub API`);

        const proxyRequest = tryOrFail('代理请求', () => fetch(proxyUrl, withFetchTimeout({
          method: 'POST',
          headers: {
            ...JSON_CONTENT_HEADERS,
            ...fetchOptions.headers,
          },
          body: JSON.stringify({
            url: urlString,
            method: fetchOptions.method ?? 'GET',
            headers: Object.fromEntries(
              Object.entries(fetchOptions.headers ?? {}).filter(
                ([_, value]) => value !== undefined,
              ),
            ),
            body: fetchOptions.body,
          }),
        }, FETCH_TIMEOUTS.github)));

        return yield* Effect.orElse(proxyRequest, () => {
          ctx.log(`${LOG_PREFIX} fallback to direct fetch`);
          return directFetch(urlString, fetchOptions);
        });
      });
    }
    return { fetchProxy } as const;
  }),
  dependencies: [],
}) {}
