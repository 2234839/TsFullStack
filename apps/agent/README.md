# TsAgent - 轻量级 TypeScript Agent 系统

TsAgent 是一个轻量级、独立的 TypeScript Agent 系统，能够自动处理用户提交的任务、自动验证执行结果、自动修复错误，并提供灵活的工具扩展能力。

## 特性

- 🚀 **轻量级**: 最小化依赖，快速启动，低资源消耗
- 🤖 **LLM 集成**: 支持多种 LLM 模型进行任务规划、执行和验证
- 🛠️ **工具系统**: 丰富的内置工具，支持自定义工具扩展
- 🔒 **安全可靠**: 基础权限验证和操作记录
- 📝 **完整日志**: 多级别日志系统，支持文件和控制台输出
- 💾 **持久化存储**: JSON 文件存储，支持备份和清理
- 🔄 **自动修复**: 错误重试和自动修复机制
- 🖼️ **图像处理**: 图像分析、生成和OCR文字识别
- 🎥 **视频处理**: 视频生成、分析和脚本生成

## 快速开始

### 安装

```bash
pnpm install
```

### 配置

复制环境变量配置文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置你的 LLM API 密钥：

```env
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
```

### 运行示例

```bash
# 基础示例
pnpm example:basic

# 文件操作示例
pnpm example:files

# HTTP 请求示例
pnpm example:http

# 多媒体功能示例
pnpm example:multimedia

# 运行所有示例
pnpm example:all
```

### 编译

```bash
pnpm build
```

## 使用方法

### 基本用法

```typescript
import { TsAgent } from '@tsagent/core';

const config = {
  storage: {
    type: 'json',
    dataDir: './data'
  },
  security: {
    enablePermissions: true,
    allowedTools: ['file_write', 'file_read', 'system_info'],
    maxTaskDuration: 300000,
    safeMode: true
  },
  logging: {
    level: 'info',
    enableConsole: true,
    enableFile: false
  },
  tools: {
    timeout: 30000
  }
};

const agent = new TsAgent(config);
await agent.initialize();

// 执行任务
const result = await agent.executeTask('创建一个测试文件');
console.log(result);

await agent.shutdown();
```

### LLM 集成

```typescript
// 使用 LLM 进行任务规划
const plan = await agent.planWithLLM('分析系统状态');

// 使用 LLM 进行工具选择
const tool = await agent.selectToolWithLLM('读取文件内容');

// 使用 LLM 进行结果验证
const isValid = await agent.validateWithLLM('任务描述', result);

// 使用 LLM 进行错误修复
const repair = await agent.repairWithLLM('任务描述', '错误信息', failedSteps);
```

### 自定义工具

```typescript
const myTool: ToolDefinition = {
  name: 'my_tool',
  description: '我的自定义工具',
  version: '1.0.0',
  permissions: ['my_tool'],
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string' }
    },
    required: ['message']
  },
  execute: async (input) => {
    return { success: true, message: input.message };
  }
};

await agent.registerTool(myTool);
```

## 内置工具

### 文件操作
- `file_write`: 写入文件
- `file_read`: 读取文件
- `file_delete`: 删除文件
- `file_list`: 列出文件

### 命令执行
- `command_execute`: 执行 shell 命令
- `command_execute_sync`: 同步执行命令
- `system_info`: 获取系统信息

### HTTP 请求
- `http_request`: 通用 HTTP 请求
- `http_get`: GET 请求
- `http_post`: POST 请求

### 图像处理
- `image_analysis`: 分析图像内容，识别物体、文字、场景等
- `image_generation`: 根据文本描述生成图像
- `ocr`: 从图像中提取文字内容 (OCR)

### 视频处理
- `video_generation`: 根据文本描述生成视频
- `video_analysis`: 分析视频内容，识别场景、物体、动作等
- `video_script`: 根据主题生成视频脚本和分镜

## 配置选项

### 存储配置
```typescript
storage: {
  type: 'json' | 'sqlite';           // 存储类型
  dataDir: string;                   // 数据目录
  backupEnabled: boolean;            // 启用备份
  backupInterval: number;           // 备份间隔
}
```

### 安全配置
```typescript
security: {
  enablePermissions: boolean;       // 启用权限
  allowedTools: string[];          // 允许的工具
  maxTaskDuration: number;         // 最大任务时长
  safeMode: boolean;              // 安全模式
}
```

### 日志配置
```typescript
logging: {
  level: 'debug' | 'info' | 'warn' | 'error';  // 日志级别
  enableConsole: boolean;         // 控制台输出
  enableFile: boolean;            // 文件输出
  logPath: string;               // 日志文件路径
  enableColors: boolean;          // 启用颜色
}
```

### LLM 配置
```typescript
// 通过环境变量配置
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.example.com

# 任务专用模型配置（推荐使用 Flash 模型）
LLM_MODEL_PLANNING=glm-4.5-flash
LLM_MODEL_EXECUTION=glm-4.5-flash
LLM_MODEL_VALIDATION=glm-4.5-air
LLM_MODEL_REPAIR=glm-4.5-air
LLM_MODEL_GENERAL=glm-4.5-flash
```

### 支持的模型

#### 文本模型
- `glm-4.5-flash`: 高性能文本生成模型
- `glm-4-flash`: 基础文本生成模型  
- `glm-z1-flash`: 轻量级文本生成模型
- `glm-4.5-air`: 高质量文本生成模型

#### 多模态模型
- `glm-4.1v-thinking-flash`: 图像理解与思考模型
- `cogview-3-flash`: 图像生成模型
- `cogvideox-flash`: 视频生成模型

## API 文档

### TsAgent 类

#### 方法
- `initialize()`: 初始化 Agent
- `executeTask(description: string)`: 执行任务
- `registerTool(tool: ToolDefinition)`: 注册工具
- `getAvailableTools()`: 获取可用工具
- `getTaskStatus(taskId: string)`: 获取任务状态
- `healthCheck()`: 健康检查
- `shutdown()`: 关闭 Agent

#### LLM 方法
- `planWithLLM(description: string)`: LLM 任务规划
- `selectToolWithLLM(description: string)`: LLM 工具选择
- `validateWithLLM(taskDescription: string, result: any)`: LLM 结果验证
- `repairWithLLM(taskDescription: string, error: string, failedSteps: any[])`: LLM 错误修复

## 开发

### 项目结构
```
src/
├── agent.ts              # 核心 Agent 类
├── task-manager.ts       # 任务管理器
├── tool-registry.ts      # 工具注册表
├── storage.ts           # 存储系统
├── logger.ts            # 日志系统
├── llm-service.ts       # LLM 服务
├── types.ts             # 类型定义
├── tools/               # 工具实现
│   ├── index.ts
│   ├── file-tools.ts
│   ├── command-tools.ts
│   └── http-tools.ts
└── index.ts             # 导出文件
```

### 测试

```bash
pnpm test
```

### 代码检查

```bash
pnpm lint
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0
- 初始版本发布
- 支持 LLM 集成
- 基础工具集
- 任务管理器
- 存储系统
- 日志系统