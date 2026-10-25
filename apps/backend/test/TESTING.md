# 🧪 TsFullStack API 测试系统

完整的后端 API 测试解决方案，直接使用后端 lib 包进行类型安全的 RPC 调用，无需前端界面。

## 🎯 特性

- ✅ **类型安全** - 直接使用后端类型定义，完整 TypeScript 支持
- ✅ **自动化测试** - 一键运行完整测试套件
- ✅ **手动测试** - 快速验证特定功能
- ✅ **测试账号管理** - 自动创建和管理测试用户
- ✅ **代币系统** - 自动发放测试代币
- ✅ **美观输出** - 清晰的测试结果展示

## 🚀 快速开始

### 前置要求

1. **启动后端服务**

   ```bash
   cd apps/backend
   pnpm dev
   ```

2. **配置环境变量**（可选）
   ```bash
   # .env
   API_BASE_URL=http://localhost:3000
   QWEN_API_KEY=your_key_here  # 如需测试 AI 功能
   ```

### 运行测试

```bash
# 完整测试套件（推荐）
pnpm test:api

# 手动快速测试
pnpm test:manual
```

## 📁 测试文件结构

```
apps/backend/test/
├── api-test-client.ts     # 测试客户端工具
├── ai-image.test.ts       # AI 图片生成测试套件
├── run-tests.ts           # 测试运行器
├── manual-test.ts         # 手动测试脚本
└── README.md              # 详细文档
```

## 🛠️ 测试工具使用

### 1. 创建测试客户端

```typescript
import { createTestClient, testAccounts } from './api-test-client';

// 创建普通客户端
const API = createTestClient();

// 创建带认证的客户端
const userSession = await testAccounts.registerTestAccount('user@test.local', 'password123');
const authAPI = testAccounts.createAuthenticatedClient(userSession);
```

### 2. 设置测试环境

```typescript
import { setupTestEnvironment } from './api-test-client';

const { userSession, authenticatedAPI } = await setupTestEnvironment();
// 自动完成：
// - 创建测试用户
// - 登录获取 token
// - 发放测试代币（月度 1000，年度 5000，永久 10000）
```

### 3. 调用 API

```typescript
// 生成 AI 图片
const result = await authenticatedAPI.apis.taskApi.generateAIImage({
  prompt: '一只可爱的猫咪',
  provider: 'qwen',
  count: 1,
  size: '1024x1024',
});

// 查询任务
const tasks = await authenticatedAPI.apis.taskApi.listTasks({
  status: 'COMPLETED',
  skip: 0,
  take: 10,
});

// 查询资源
const resources = await authenticatedAPI.apis.taskApi.listResources({
  type: 'IMAGE',
  skip: 0,
  take: 20,
});
```

## 📋 测试用例覆盖

### AI 图片生成测试

- ✅ 生成单张图片
- ✅ 生成多张图片（1-4张）
- ✅ 生成不同尺寸（1024x1024, 1024x768, 512x512）
- ✅ 参数验证（空提示词、超量、代币不足）
- ✅ 多服务商支持（通义千问、DALL-E、Stability）

### 代币管理测试

- ✅ 查询可用代币
- ✅ 检查代币是否足够
- ✅ 代币消耗验证
- ✅ 组合消耗（月度→年度→永久优先级）

### 任务管理测试

- ✅ 创建任务
- ✅ 查询任务列表
- ✅ 查询任务详情
- ✅ 任务状态流转（PENDING → PROCESSING → COMPLETED）

### 资源管理测试

- ✅ 创建资源
- ✅ 查询资源列表
- ✅ 按类型筛选
- ✅ 按状态筛选

## 🔧 自定义测试

### 添加新测试用例

1. 在 `test/` 目录创建测试文件
2. 使用测试工具：

```typescript
import { setupTestEnvironment } from './api-test-client';

async function testMyNewFeature() {
  const { authenticatedAPI } = await setupTestEnvironment();

  // 你的测试逻辑
  const result = await authenticatedAPI.apis.yourNewApi.method({
    param: 'value',
  });

  console.log('测试结果:', result);
}

testMyNewFeature();
```

### 测试特定功能

```typescript
// 测试代币发放
await authenticatedAPI.apis.testApi.grantTestTokens({
  userId: userSession.userId,
  monthly: 500,
  yearly: 1000,
  permanent: 2000,
});

// 测试代币消耗
const before = await authenticatedAPI.apis.testApi.getAvailableTokens({
  userId: userSession.userId,
});
// ... 执行操作
const after = await authenticatedAPI.apis.testApi.getAvailableTokens({
  userId: userSession.userId,
});
console.log('消耗代币:', before.total - after.total);
```

## 🐛 故障排查

### 常见问题

**Q: 后端服务未运行**

```
A: 确保后端服务正在运行：
   cd apps/backend
   pnpm dev
```

**Q: API Key 未配置**

```
A: 在 .env 文件中配置：
   QWEN_API_KEY=your_key
```

**Q: 类型错误**

```
A: 重新生成类型并构建：
   pnpm zenstack generate
   pnpm build:lib
```

**Q: 测试账号冲突**

```
A: 测试会自动处理已存在的账号，
   或修改 TEST_ACCOUNTS 中的邮箱地址
```

## 📊 测试输出示例

```
========================================
🧪 AI 图片生成 API 测试套件
========================================

🧪 设置测试环境...
  ✓ 创建测试用户...
    - 用户ID: user_123abc
    - Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ✓ 发放测试代币...
    - 月度代币: 1000
    - 年度代币: 5000
    - 永久代币: 10000
✅ 测试环境设置完成!

  🎨 生成提示词: 一只可爱的橘猫，坐在窗台上...
  💰 可用代币总计: 16000
  ✅ 生成成功!
     - 任务ID: 123
     - 生成数量: 1
     - 图片URL: https://...

========================================
✅ 所有测试通过!
========================================
```

## 🎓 最佳实践

1. **独立测试** - 每个测试用例独立运行，不依赖其他测试
2. **清理数据** - 测试完成后清理创建的数据
3. **使用枚举** - 使用 TokenType、TaskStatus 等枚举而非字符串
4. **错误处理** - 正确处理和验证错误情况
5. **日志记录** - 使用 console.log 输出关键信息

## 🔗 相关文档

- [后端 API 文档](../../src/api/README.md)
- [数据库模型](../../schema.zmodel)
- [前端集成](../../website-frontend/README.md)

## 📝 TODO

- [ ] 添加图片下载测试
- [ ] 添加并发请求测试
- [ ] 添加性能压力测试
- [ ] 添加更多 AI 服务商测试
- [ ] 集成到 CI/CD 流程
