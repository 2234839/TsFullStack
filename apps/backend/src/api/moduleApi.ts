import { api } from '@tsfullstack/module-autoload/api';
export const moduleApis = api;

// 保留测试调用
api.template.api.test();
