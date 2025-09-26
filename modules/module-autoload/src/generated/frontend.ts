// ABOUTME: 自动生成的前端聚合导入导出文件
// 生成时间: 2025-09-25T10:41:13.171Z
// 包含模块: module-template

import * as template from '@tsfullstack/module-template/frontend';

export { template };
export type * as templateTypes from '@tsfullstack/module-template/frontend';

// 版本信息
export const modules = {
  'template': '0.1.0'
};

// 导出所有模块的前端组件
export const components = {
  template
};

// 确保导出不被 tree-shaking 移除
if (process.env.NODE_ENV === 'development') {
  console.log('Frontend modules:', Object.keys(modules));
  console.log('Frontend exports:', Object.keys(components));
}