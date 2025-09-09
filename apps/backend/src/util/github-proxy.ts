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
    const githubProxyUrl = appConfig.ApiProxy.github;
    const ctx = yield* ReqCtxService;

    function fetchProxy(url: string | URL, options: ProxyFetchOptions = {}) {
      return Effect.gen(function* () {
        const { useProxy = true, ...fetchOptions } = options;

        ctx.log(`fetch proxy, githubProxyUrl:${githubProxyUrl}  targetUrl:${url}`);
        // If proxy is not configured or explicitly disabled, use direct fetch
        if (!useProxy || !githubProxyUrl) {
          return yield* Effect.promise(() => fetch(url, fetchOptions));
        }

        // Use proxy for GitHub API calls
        const urlString = url.toString();

        // Check if this is a GitHub API call
        if (urlString.includes('api.github.com') || urlString.includes('github.com')) {
          const proxyUrl = new URL(githubProxyUrl);

          // For GitHub API, use the dedicated endpoint
          if (urlString.includes('api.github.com')) {
            const apiPath = urlString.replace('https://api.github.com', '');
            proxyUrl.pathname = `/github${apiPath}`;
          } else {
            // For other GitHub URLs, use the generic proxy
            proxyUrl.pathname = '/proxy';
          }

          try {
            // For generic proxy, we need to send the original URL and method
            if (proxyUrl.pathname === '/proxy') {
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
            } else {
              return yield* Effect.promise(() => fetch(proxyUrl, fetchOptions));
            }
          } catch (error) {
            console.warn('Proxy request failed, falling back to direct fetch:', error);
            return yield* Effect.promise(() => fetch(url, fetchOptions));
          }
        }

        // For non-GitHub URLs, use direct fetch
        return yield* Effect.promise(() => fetch(url, fetchOptions));
      });
    }
    return { fetchProxy } as const;
  }),
  dependencies: [],
}) {}
FetchWithProxy.Default