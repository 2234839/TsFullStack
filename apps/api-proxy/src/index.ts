interface Env {
  ENVIRONMENT: string;
}

interface ProxyRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 支持 CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent',
    };

    // 处理 OPTIONS 请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      
      // 健康检查端点
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          message: 'API Proxy is running',
          environment: env.ENVIRONMENT 
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // 通用代理端点
      if (url.pathname === '/proxy') {
        return await handleProxy(request, corsHeaders);
      }

      // 直接代理 GitHub API (格式: /github/...)
      if (url.pathname.startsWith('/github/')) {
        return await handleDirectProxy(request, corsHeaders, 'github');
      }

      // 直接代理 npm API (格式: /npm/...)
      if (url.pathname.startsWith('/npm/')) {
        return await handleDirectProxy(request, corsHeaders, 'npm');
      }

      // 默认响应
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'Available endpoints: /health, /proxy, /github/*, /npm/*',
        usage: {
          proxy: 'POST /proxy with JSON body containing { url, method?, headers?, body? }',
          direct: 'GET/POST /github/api/v3/... or /npm/registry/...'
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Proxy error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};

async function handleProxy(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const proxyRequest: ProxyRequest = await request.json();
    
    if (!proxyRequest.url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 验证 URL 是否为允许的 URL
    if (!isValidUrl(proxyRequest.url)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid URL',
        message: 'Only GitHub and npm URLs are allowed'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 构建请求头
    const headers = new Headers();
    if (proxyRequest.headers) {
      Object.entries(proxyRequest.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

    // 添加 User-Agent 避免被拒绝
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', 'API-Proxy-Worker/1.0');
    }

    // 发起请求
    const response = await fetch(proxyRequest.url, {
      method: proxyRequest.method || 'GET',
      headers: headers,
      body: proxyRequest.body
    });

    // 复制响应头
    const responseHeaders = new Headers(corsHeaders);
    response.headers.forEach((value, key) => {
      // 跳过一些可能导致问题的响应头
      if (!['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // 返回响应
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Proxy request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleDirectProxy(request: Request, corsHeaders: Record<string, string>, platform: string): Promise<Response> {
  const url = new URL(request.url);
  let targetUrl: string;
  
  if (platform === 'github') {
    const githubPath = url.pathname.replace('/github', '');
    targetUrl = `https://api.github.com${githubPath}${url.search}`;
  } else if (platform === 'npm') {
    const npmPath = url.pathname.replace('/npm', '');
    targetUrl = `https://registry.npmjs.org${npmPath}${url.search}`;
  } else {
    return new Response(JSON.stringify({ 
      error: 'Unsupported platform',
      message: 'Only GitHub and npm are supported'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // 验证 URL
  if (!isValidUrl(targetUrl)) {
    return new Response(JSON.stringify({ 
      error: 'Invalid URL',
      message: 'Only GitHub and npm URLs are allowed'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
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
    headers.set('User-Agent', 'API-Proxy-Worker/1.0');
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body
    });

    // 复制响应头
    const responseHeaders = new Headers(corsHeaders);
    response.headers.forEach((value, key) => {
      if (!['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'API request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    // 支持 GitHub 和 npm
    return parsedUrl.hostname === 'api.github.com' || 
           parsedUrl.hostname === 'github.com' ||
           parsedUrl.hostname === 'raw.githubusercontent.com' ||
           parsedUrl.hostname === 'registry.npmjs.org';
  } catch {
    return false;
  }
}