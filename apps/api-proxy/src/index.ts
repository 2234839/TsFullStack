interface Env {
  ENVIRONMENT: string;
}


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 检查是否为浏览器直接访问
    if (isBrowserDirectAccess(request)) {
      return new Response(
        JSON.stringify({
          error: 'Direct browser access not allowed',
          message: 'This service is for API use only',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // 支持 CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, User-Agent, X-Api-Key, X-Requested-With',
    };

    // 处理 OPTIONS 请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);

      // 首页 - 显示运行状态
      if (url.pathname === '/') {
        const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub API Gateway</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background-color: #f6f8fa;
            color: #24292f;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 2rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        h1 {
            color: #0969da;
            margin-top: 0;
        }
        .status {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 500;
            background-color: #2da44e;
            color: white;
        }
        .endpoint {
            background-color: #f6f8fa;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            padding: 1rem;
            margin: 1rem 0;
            font-family: 'Monaco', 'Menlo', monospace;
        }
        .description {
            color: #57606a;
            margin: 0.5rem 0;
        }
        .warning {
            background-color: #fff5b9;
            border: 1px solid #d29922;
            border-radius: 6px;
            padding: 1rem;
            margin: 1rem 0;
        }
        .warning-title {
            color: #953800;
            font-weight: 600;
            margin: 0 0 0.5rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 GitHub API Gateway</h1>
        
        <p>
            <span class="status">运行中</span>
            <strong>环境：</strong>${env.ENVIRONMENT}
        </p>
        
        <div class="warning">
            <div class="warning-title">⚠️ 使用说明</div>
            <p>此服务仅用于 GitHub OAuth 认证，已限制只能访问 GitHub 相关的认证接口。</p>
        </div>
        
        <h2>可用端点</h2>
        
        <div class="endpoint">
            <strong>GET /health</strong>
            <p class="description">健康检查端点</p>
        </div>
        
        <div class="endpoint">
            <strong>GET /github/*</strong>
            <p class="description">直接转发 GitHub API 请求</p>
            <p class="description">例如：/github/user, /github/user/emails</p>
        </div>
        
        <h2>限制说明</h2>
        <ul>
            <li>仅允许访问 GitHub 相关域名</li>
            <li>仅允许 OAuth 认证和用户信息相关接口</li>
            <li>禁止浏览器直接访问（首页除外）</li>
            <li>所有请求都会被记录和监控</li>
        </ul>
        
        <div class="warning">
            <div class="warning-title">🔒 安全提醒</div>
            <p>此服务专门为 TsFullStack 项目的 GitHub 登录功能设计，请勿用于其他用途。</p>
        </div>
    </div>
</body>
</html>
        `;
        return new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // 健康检查端点
      if (url.pathname === '/health') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            message: 'API Gateway is running',
            environment: env.ENVIRONMENT,
          }),
          {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          },
        );
      }

      
      // 代理端点 - POST 请求传递完整目标 URL
      if (url.pathname === '/proxy') {
        return await handleProxyRequest(request, corsHeaders);
      }

      // 直接转发 GitHub API (格式: /github/...)
      if (url.pathname.startsWith('/github/')) {
        return await handleDirectProxy(request, corsHeaders, 'github');
      }

      // 默认响应
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          message: 'Available endpoints: /health, /github/*',
          usage: {
            direct: 'GET/POST /github/api/v3/...',
          },
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    } catch (error) {
      console.error('Gateway error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }
  },
};


async function handleProxyRequest(
  request: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
        message: 'Only POST method is supported for proxy endpoint',
      }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }

  try {
    const body = await request.json() as { url: string; method?: string; headers?: Record<string, string>; body?: string };
    const { url: targetUrl, method = 'GET', headers = {}, body: requestBody } = body;

    // 验证目标 URL
    if (!targetUrl || !isValidUrl(targetUrl)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid URL',
          message: 'Target URL is not allowed',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    // 构建请求头
    const proxyHeaders = new Headers();
    Object.entries(headers).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        proxyHeaders.set(key, String(value));
      }
    });

    // 添加默认 User-Agent
    if (!proxyHeaders.has('User-Agent')) {
      proxyHeaders.set('User-Agent', 'API-Gateway-Proxy/1.0');
    }

    // 发送请求
    const response = await fetch(targetUrl, {
      method,
      headers: proxyHeaders,
      body: requestBody,
    });

    // 复制响应头
    const responseHeaders = new Headers(corsHeaders);
    response.headers.forEach((value, key) => {
      if (
        ![
          'access-control-allow-origin',
          'access-control-allow-methods',
          'access-control-allow-headers',
        ].includes(key.toLowerCase())
      ) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy request error:', error);
    return new Response(
      JSON.stringify({
        error: 'Proxy request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}

async function handleDirectProxy(
  request: Request,
  corsHeaders: Record<string, string>,
  platform: string,
): Promise<Response> {
  const url = new URL(request.url);
  let targetUrl: string;

  if (platform === 'github') {
    const githubPath = url.pathname.replace('/github', '');
    
    // 根据路径决定目标域名
    if (githubPath.startsWith('/login/oauth/') || githubPath.startsWith('/settings/')) {
      // OAuth 相关端点使用 github.com
      targetUrl = `https://github.com${githubPath}${url.search}`;
    } else {
      // API 端点使用 api.github.com
      targetUrl = `https://api.github.com${githubPath}${url.search}`;
    }
  } else {
    return new Response(
      JSON.stringify({
        error: 'Unsupported platform',
        message: 'Only GitHub is supported',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }

  // 验证 URL
  if (!isValidUrl(targetUrl)) {
    return new Response(
      JSON.stringify({
        error: 'Invalid URL',
        message: 'Only GitHub OAuth and user-related URLs are allowed',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }

  // 构建请求头
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // 跳过一些不需要的请求头
    if (!['host', 'origin'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  // 添加 User-Agent
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'API-Gateway-Worker/1.0');
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
    });

    // 复制响应头
    const responseHeaders = new Headers(corsHeaders);
    response.headers.forEach((value, key) => {
      if (
        ![
          'access-control-allow-origin',
          'access-control-allow-methods',
          'access-control-allow-headers',
        ].includes(key.toLowerCase())
      ) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'API request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}

/**
 * 检查是否为浏览器直接访问
 */
function isBrowserDirectAccess(request: Request): boolean {
  const userAgent = request.headers.get('User-Agent') || '';
  const accept = request.headers.get('Accept') || '';
  const referer = request.headers.get('Referer') || '';
  const origin = request.headers.get('Origin') || '';

  // 检查是否为浏览器 User-Agent
  const isBrowserUA = /(chrome|safari|firefox|edge|opera|msie|trident)/i.test(userAgent);

  // 检查是否为 HTML 请求
  const isHtmlRequest = accept.includes('text/html') || accept.includes('*/*');

  // 检查是否缺少 API 相关的标识
  const hasApiHeaders =
    request.headers.get('X-Requested-With') === 'XMLHttpRequest' ||
    request.headers.get('X-Api-Key') ||
    accept.includes('application/json') ||
    request.headers.get('Authorization');

  // 健康检查端点和首页允许浏览器访问
  const url = new URL(request.url);
  if (url.pathname === '/health' || url.pathname === '/') {
    return false;
  }

  // 如果是浏览器且没有 API 标识，则认为是直接访问
  return isBrowserUA && isHtmlRequest && !hasApiHeaders && !referer && !origin;
}

function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    console.log('[api-proxy] validating url:', url);

    // 允许的域名白名单
    const allowedHostnames = ['github.com', 'api.github.com', 'raw.githubusercontent.com', 'connect.linuxdo.org'];

    if (!allowedHostnames.includes(parsedUrl.hostname)) {
      return false;
    }

    // 对 github.com 进行更严格的路径限制
    if (parsedUrl.hostname === 'github.com') {
      // 只允许 OAuth 相关路径
      const allowedPaths = [
        '/login/oauth/authorize',
        '/login/oauth/access_token',
        '/login/oauth/authorize',
        '/settings/connections/applications',
      ];

      const isOAuthPath = allowedPaths.some((path) => parsedUrl.pathname.startsWith(path));

      if (!isOAuthPath) {
        return false;
      }
    }

    // 对 api.github.com 限制为认证相关端点
    if (parsedUrl.hostname === 'api.github.com') {
      const allowedApiPaths = [
        '/user',
        '/user/emails',
        '/user/public_emails',
        '/user/followers',
        '/user/following',
        '/user/orgs',
        '/user/repos',
        '/applications/',
        '/applications/tokens',
      ];

      const isAllowedApiPath = allowedApiPaths.some((path) => parsedUrl.pathname.startsWith(path));

      if (!isAllowedApiPath) {
        return false;
      }
    }

    // 对 connect.linuxdo.org 限制为 OAuth2 相关端点
    if (parsedUrl.hostname === 'connect.linuxdo.org') {
      const allowedPaths = ['/oauth2/token', '/api/user'];
      const isAllowedPath = allowedPaths.some((path) => parsedUrl.pathname.startsWith(path));
      if (!isAllowedPath) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
