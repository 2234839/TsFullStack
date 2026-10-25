/**
 * API 测试客户端
 * 用于测试后端 API，直接使用 RPC 调用，无需前端界面
 */

import { createRPC } from '../src/lib';
import type { API } from '../src/lib';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

/**
 * 创建测试客户端
 */
export function createTestClient() {
  const { API } = createRPC<API>('apiConsumer', {
    remoteCall: async (method: string, data: any[]) => {
      const url = `${API_BASE_URL}/api/${method}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API 调用失败: ${error}`);
      }

      return response.json();
    },
  });

  return API;
}

/**
 * 测试用户会话
 */
export interface TestSession {
  token: string;
  userId: string;
  email: string;
}

/**
 * 测试账号管理器
 */
export class TestAccountManager {
  private sessions = new Map<string, TestSession>();

  /**
   * 注册测试账号
   */
  async registerTestAccount(email: string, password: string): Promise<TestSession> {
    const API = createTestClient();

    try {
      // 尝试注册
      await API.authApi.register({
        email,
        password,
        username: email.split('@')[0],
      });

      // 注册成功后登录
      return await this.loginTestAccount(email, password);
    } catch (error: any) {
      // 如果账号已存在，直接登录
      if (error.message?.includes('已存在')) {
        return await this.loginTestAccount(email, password);
      }
      throw error;
    }
  }

  /**
   * 登录测试账号
   */
  async loginTestAccount(email: string, password: string): Promise<TestSession> {
    const API = createTestClient();

    const loginResult = await API.authApi.passwordLogin({
      email,
      password,
    });

    const session: TestSession = {
      token: loginResult.token,
      userId: loginResult.user.id,
      email: loginResult.user.email,
    };

    // 保存会话
    this.sessions.set(email, session);

    return session;
  }

  /**
   * 获取已登录的会话
   */
  getSession(email: string): TestSession | undefined {
    return this.sessions.get(email);
  }

  /**
   * 创建带认证的测试客户端
   */
  createAuthenticatedClient(session: TestSession) {
    const API = createTestClient();

    // 包装 API 调用，自动添加 token
    return new Proxy(API, {
      get(target, prop) {
        const value = (target as any)[prop];

        if (typeof value === 'function') {
          return async (...args: any[]) => {
            // 在调用前设置 token
            process.env.TEST_AUTH_TOKEN = session.token;
            try {
              return await value.apply(target, args);
            } finally {
              delete process.env.TEST_AUTH_TOKEN;
            }
          };
        }

        return value;
      },
    });
  }
}

/**
 * 全局测试账号管理器实例
 */
export const testAccounts = new TestAccountManager();

/**
 * 预定义的测试账号
 */
export const TEST_ACCOUNTS = {
  admin: {
    email: 'admin@test.local',
    password: 'admin123456',
    description: '管理员账号（需要手动创建）',
  },
  user: {
    email: 'user@test.local',
    password: 'user123456',
    description: '普通用户账号',
  },
} as const;

/**
 * 初始化测试环境
 * - 创建测试账号
 * - 发放测试代币
 */
export async function setupTestEnvironment() {
  console.log('🧪 设置测试环境...');

  // 1. 创建测试用户
  console.log('  ✓ 创建测试用户...');
  const userSession = await testAccounts.registerTestAccount(TEST_ACCOUNTS.user.email, TEST_ACCOUNTS.user.password);
  console.log(`    - 用户ID: ${userSession.userId}`);
  console.log(`    - Token: ${userSession.token.substring(0, 20)}...`);

  // 2. 创建带认证的客户端
  const authenticatedAPI = testAccounts.createAuthenticatedClient(userSession);

  // 3. 发放测试代币
  console.log('  ✓ 发放测试代币...');
  try {
    await authenticatedAPI.apis.testApi.grantTestTokens({
      userId: userSession.userId,
      monthly: 1000,
      yearly: 5000,
      permanent: 10000,
    });
    console.log('    - 月度代币: 1000');
    console.log('    - 年度代币: 5000');
    console.log('    - 永久代币: 10000');
  } catch (error) {
    console.log('    ⚠ 代币发放失败（可能 testApi 不存在）');
  }

  console.log('✅ 测试环境设置完成!\n');

  return {
    userSession,
    authenticatedAPI,
  };
}
