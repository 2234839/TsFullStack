// 测试引用共享包
import { buildNestedTree, type RouteTree } from '@tsfullstack/shared-frontend/utils';
import { type ModuleFrontendConfig } from '@tsfullstack/shared-frontend/types';

export const api = {
  test() {
    return "test date : "+ new Date().toLocaleString()
  },

  testSharedPackage() {
    // 测试路由工具函数
    const testRoutes: RouteTree = {
      home: {
        path: '/home',
        component: () => Promise.resolve({}),
        meta: {
          title: 'Home',
          icon: 'pi pi-home'
        }
      }
    };

    const result = buildNestedTree(testRoutes);

    // 测试类型定义
    const config: ModuleFrontendConfig = {
      name: 'test-module',
      version: '1.0.0',
      enabled: true,
      routes: testRoutes
    };

    return {
      routesBuilt: Object.keys(result).length > 0,
      configValid: !!config.name,
      timestamp: new Date().toISOString()
    };
  }
};