import { ToolDefinition } from '../types';

export const httpRequestTool: ToolDefinition = {
  name: 'http_request',
  description: 'Make HTTP requests safely',
  version: '1.0.0',
  permissions: ['http_request'],
  inputSchema: {
    type: 'object',
    properties: {
      url: { 
        type: 'string',
        description: 'URL to request'
      },
      method: { 
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        default: 'GET',
        description: 'HTTP method'
      },
      headers: {
        type: 'object',
        description: 'HTTP headers'
      },
      body: {
        type: 'string',
        description: 'Request body'
      },
      timeout: {
        type: 'number',
        default: 10000,
        description: 'Timeout in milliseconds'
      },
      followRedirects: {
        type: 'boolean',
        default: true,
        description: 'Follow redirects'
      }
    },
    required: ['url']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      status: { type: 'number' },
      headers: { type: 'object' },
      body: { type: 'string' },
      message: { type: 'string' }
    }
  },
  timeout: 15000,
  validate: (input) => {
    // URL validation
    try {
      new URL(input.url);
    } catch {
      return false;
    }

    // Security checks
    const url = new URL(input.url);
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(url.protocol)) {
      return false;
    }

    // Prevent localhost access in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = url.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
        return false;
      }
    }

    return typeof input.method === 'string' &&
           ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(input.method) &&
           (input.headers === undefined || typeof input.headers === 'object') &&
           (input.body === undefined || typeof input.body === 'string') &&
           (input.timeout === undefined || typeof input.timeout === 'number' && input.timeout > 0) &&
           (input.followRedirects === undefined || typeof input.followRedirects === 'boolean');
  },
  execute: async (input) => {
    try {
      const url = new URL(input.url);
      const method = input.method || 'GET';
      const headers = input.headers || {};
      const body = input.body;
      const timeout = input.timeout || 10000;
      const followRedirects = input.followRedirects !== false;

      // Set default headers
      if (!headers['User-Agent']) {
        headers['User-Agent'] = 'TsAgent/1.0.0';
      }
      if (body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const options: RequestInit = {
        method,
        headers,
        body: body,
        signal: controller.signal,
        redirect: followRedirects ? 'follow' : 'manual'
      };

      const response = await fetch(url.toString(), options);
      clearTimeout(timeoutId);

      // Read response body
      let responseBody = '';
      try {
        responseBody = await response.text();
      } catch (error) {
        // If body reading fails, continue with empty body
        console.warn('Failed to read response body:', error);
      }

      // Get response headers
      const responseHeaders: any = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const success = response.status >= 200 && response.status < 300;

      return {
        success,
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
        message: success ? 'Request successful' : `Request failed with status ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        status: 0,
        headers: {},
        body: '',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

export const httpGetTool: ToolDefinition = {
  name: 'http_get',
  description: 'Simple HTTP GET request',
  version: '1.0.0',
  permissions: ['http_request'],
  inputSchema: {
    type: 'object',
    properties: {
      url: { 
        type: 'string',
        description: 'URL to fetch'
      },
      headers: {
        type: 'object',
        description: 'Optional headers'
      },
      timeout: {
        type: 'number',
        default: 10000,
        description: 'Timeout in milliseconds'
      }
    },
    required: ['url']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      content: { type: 'string' },
      status: { type: 'number' },
      message: { type: 'string' }
    }
  },
  timeout: 15000,
  validate: (input) => {
    try {
      new URL(input.url);
      return true;
    } catch {
      return false;
    }
  },
  execute: async (input) => {
    try {
      const url = input.url;
      const headers = input.headers || {};
      const timeout = input.timeout || 10000;

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeout)
      });

      const content = await response.text();
      const success = response.ok;

      return {
        success,
        content,
        status: response.status,
        message: success ? 'GET request successful' : `GET request failed with status ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        status: 0,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

export const httpPostTool: ToolDefinition = {
  name: 'http_post',
  description: 'Simple HTTP POST request',
  version: '1.0.0',
  permissions: ['http_request'],
  inputSchema: {
    type: 'object',
    properties: {
      url: { 
        type: 'string',
        description: 'URL to post to'
      },
      data: {
        type: 'object',
        description: 'Data to post (will be JSON stringified)'
      },
      headers: {
        type: 'object',
        description: 'Optional headers'
      },
      timeout: {
        type: 'number',
        default: 10000,
        description: 'Timeout in milliseconds'
      }
    },
    required: ['url', 'data']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      response: { type: 'string' },
      status: { type: 'number' },
      message: { type: 'string' }
    }
  },
  timeout: 15000,
  validate: (input) => {
    try {
      new URL(input.url);
      return typeof input.data === 'object';
    } catch {
      return false;
    }
  },
  execute: async (input) => {
    try {
      const url = input.url;
      const data = input.data;
      const headers = {
        'Content-Type': 'application/json',
        ...input.headers
      };
      const timeout = input.timeout || 10000;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(timeout)
      });

      const responseText = await response.text();
      const success = response.ok;

      return {
        success,
        response: responseText,
        status: response.status,
        message: success ? 'POST request successful' : `POST request failed with status ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        response: '',
        status: 0,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
};