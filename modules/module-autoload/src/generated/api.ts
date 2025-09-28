// ABOUTME: 自动生成的 API 聚合导入导出文件
// 生成时间: 2025-09-28T12:03:19.865Z
// 包含模块: module-template

import * as template from '@tsfullstack/module-template/api';

export { template };
export type * as templateTypes from '@tsfullstack/module-template/api';

// 版本信息
export const modules = {
  'template': '0.1.0'
};

// 导出所有模块的 API
export const api = {
  template
};

// 确保导出不被 tree-shaking 移除
if (process.env.NODE_ENV === 'development') {
  console.log('API modules:', Object.keys(modules));
  console.log('API exports:', Object.keys(api));
}