/** ABOUTME: Test backend project entry point */
import { Effect } from 'effect';

// 直接导出 API 函数
const test = ({ message }: { message: string }) =>
  Effect.succeed({
    response: `Test backend received: ${message}`,
    timestamp: Date.now(),
  });

const getProjectInfo = () =>
  Effect.succeed({
    name: 'Test Backend Project ',
    version: '1.0.0',
    description: 'A test backend project for dynamic loading system 1',
  });

// 导出 API 定义（向后兼容）
export const apiDefinition = {
  test,
  getProjectInfo,
};

// 导出项目元数据
export const projectMetadata = {
  name: 'test-backend-project',
  version: '1.0.0',
  description: 'Test backend project for TsFullStack',
  apis: Object.keys(apiDefinition),
} as const;
