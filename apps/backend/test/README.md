# API 测试指南

本目录包含后端 API 的测试工具和测试用例，可以直接测试后端功能，无需前端界面。

## 快速开始

### 1. 启动后端服务

```bash
cd apps/backend
pnpm dev
```

确保后端服务运行在 `http://localhost:3000`

### 2. 运行 API 测试

```bash
# 方式 1: 使用 npm 脚本（推荐）
pnpm test:api

# 方式 2: 直接使用 tsx 运行
npx tsx test/run-tests.ts
```

测试会自动：
- ✅ 创建测试用户账号
- ✅ 发放测试代币
- ✅ 运行所有 AI 图片生成测试用例
- ✅ 验证代币消耗
- ✅ 验证任务和资源创建

## 测试文件说明

### `api-test-client.ts`
API 测试客户端工具，提供：
- `createTestClient()` - 创建测试客户端
- `TestAccountManager` - 管理测试账号（注册、登录、会话管理）
- `setupTestEnvironment()` - 初始化测试环境

**示例：**
```typescript
import { setupTestEnvironment, testAccounts } from './api-test-client';

// 设置测试环境
const { userSession, authenticatedAPI } = await setupTestEnvironment();

// 使用认证的 API
const result = await authenticatedAPI.apis.taskApi.generateAIImage({
  prompt: '一只可爱的猫咪',
  provider: 'qwen',
  count: 1,
});
```

### `ai-image.test.ts`
AI 图片生成功能的完整测试套件，包含：

#### 代币管理测试
- ✅ 查询可用代币
- ✅ 检查代币是否足够

#### AI 图片生成测试
- ✅ 生成单张图片
- ✅ 生成多张图片
- ✅ 生成不同尺寸图片
- ✅ 拒绝空提示词
- ✅ 拒绝超过最大数量
- ✅ 拒绝代币不足

#### 任务查询测试
- ✅ 查询任务列表
- ✅ 查询任务详情

#### 资源查询测试
- ✅ 查询资源列表
- ✅ 按类型筛选资源

#### 代币消耗验证测试
- ✅ 验证代币正确消耗

### `run-tests.ts`
测试运行器，提供：
- 自动检查后端服务是否运行
- 自动运行所有测试用例
- 美化的测试输出

## 自定义测试用例

### 创建新的测试文件

1. 在 `test/` 目录创建新文件，如 `my-feature.test.ts`
2. 使用测试客户端工具：

```typescript
import { setupTestEnvironment } from './api-test-client';

async function testMyFeature() {
  // 1. 设置测试环境
  const { authenticatedAPI } = await setupTestEnvironment();

  // 2. 编写测试逻辑
  const result = await authenticatedAPI.apis.someApi.someMethod({
    param1: 'value1',
  });

  // 3. 验证结果
  console.log('测试结果:', result);
}

// 运行测试
testMyFeature();
```

### 测试账号配置

预定义的测试账号在 `TEST_ACCOUNTS` 中：

```typescript
export const TEST_ACCOUNTS = {
  admin: {
    email: 'admin@test.local',
    password: 'admin123456',
  },
  user: {
    email: 'user@test.local',
    password: 'user123456',
  },
};
```

## 测试最佳实践

### 1. 使用 setupTestEnvironment
每个测试套件开始时调用，确保环境干净：

```typescript
beforeAll(async () => {
  const setup = await setupTestEnvironment();
  authenticatedAPI = setup.authenticatedAPI;
});
```

### 2. 清理测试数据
测试完成后可以选择性清理：

```typescript
afterAll(async () => {
  // 清理测试创建的数据
  await authenticatedAPI.apis.testApi?.cleanupTestData?.();
});
```

### 3. 独立的测试用例
每个测试用例应该独立，不依赖其他用例的执行顺序：

```typescript
it('应该能够生成图片', async () => {
  // 每次都重新创建数据，不依赖之前的测试
  const result = await authenticatedAPI.apis.taskApi.generateAIImage({...});
  expect(result).toBeDefined();
});
```

## 故障排查

### 后端服务未运行
```
❌ 无法连接到后端服务: http://localhost:3000
   请确保后端服务正在运行: pnpm dev
```

**解决方案：**
```bash
cd apps/backend
pnpm dev
```

### API Key 未配置
```
❌ 调用 AI 服务失败: 通义千问 API Key 未配置
```

**解决方案：**
在 `.env` 文件中配置：
```bash
QWEN_API_KEY=your_api_key_here
```

### 类型错误
```
❌ TypeScript 编译错误
```

**解决方案：**
```bash
# 重新生成类型
pnpm zenstack generate

# 重新构建后端库
pnpm build:lib
```

## 扩展测试

### 添加更多 AI 服务商测试

```typescript
it('应该支持 DALL-E 生成图片', async () => {
  const result = await authenticatedAPI.apis.taskApi.generateAIImage({
    prompt: 'A beautiful sunset',
    provider: 'dalle',
    count: 1,
  });

  expect(result).toBeDefined();
});
```

### 添加图片下载测试

```typescript
it('应该能够下载并保存图片', async () => {
  // 先生成图片
  const generateResult = await authenticatedAPI.apis.taskApi.generateAIImage({...});

  // 下载图片
  const downloadResult = await authenticatedAPI.apis.taskApi.selectAndDownloadImage({
    taskId: generateResult.taskId,
    imageUrl: generateResult.images[0],
    compressOptions: {
      enabled: true,
      format: 'jpeg',
      quality: 85,
    },
  });

  expect(downloadResult.fileUrl).toBeDefined();
});
```

## 运行特定测试

可以使用环境变量控制测试行为：

```bash
# 指定后端服务地址
API_BASE_URL=http://localhost:3000 pnpm test:api

# 跳过环境检查
SKIP_ENV_CHECK=true pnpm test:api
```

## 测试覆盖率

当前测试覆盖：
- ✅ 代币管理（查询、检查、消耗）
- ✅ AI 图片生成（多种配置）
- ✅ 任务管理（创建、查询、状态更新）
- ✅ 资源管理（创建、查询、筛选）
- ✅ 错误处理（参数验证、权限检查）

未来可以添加：
- ⏳ 图片下载和压缩
- ⏳ 文件上传集成
- ⏳ 权限控制测试
- ⏳ 并发请求测试
