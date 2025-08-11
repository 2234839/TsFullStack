# TsAgent 使用指南

## 快速开始

### 1. 基础配置

```typescript
import { TsAgent } from '@tsagent/core';

// 基础配置
const config = {
  storage: {
    type: 'json' as const,
    dataDir: './data'
  },
  security: {
    enablePermissions: true,
    allowedTools: ['file_write', 'file_read', 'system_info'],
    maxTaskDuration: 300000,
    safeMode: true
  },
  logging: {
    level: 'info' as const,
    enableConsole: true,
    enableFile: false
  },
  tools: {
    timeout: 30000
  }
};

const agent = new TsAgent(config);
await agent.initialize();
```

### 2. 启用交互式模式

```typescript
const interactiveConfig = {
  ...config,
  interactive: {
    enabled: true,                    // 启用交互式决策
    confirmBeforeExecution: true,     // 执行前确认
    askForClarification: true,        // 需要澄清时询问
    maxQuestions: 5                   // 最大询问次数
  }
};

const agent = new TsAgent(interactiveConfig);
```

### 3. 执行任务

```typescript
// 简单任务执行
const result = await agent.executeTask('创建一个测试文件');
console.log('任务结果:', result);

// 使用 LLM 进行复杂任务
const plan = await agent.planWithLLM('分析系统状态');
const result = await agent.executeTask(plan);
```

## 交互式功能详解

### 用户确认

当 `confirmBeforeExecution` 启用时，Agent 会在执行每个工具前询问用户：

```
是否要执行工具 "file_write"?
描述: 创建测试文件
输入: {"path":"./test.txt","content":"Hello World"}
yes/no: yes
```

### 任务澄清

当 `askForClarification` 启用时，Agent 会要求澄清模糊的任务描述：

```
任务描述存在歧义: "处理文件"
请澄清任务 "处理文件": 删除所有临时文件
```

### 选择确认

对于需要选择的操作，Agent 会提供选项：

```
请选择文件处理方式:
1. 删除文件
2. 移动文件
3. 复制文件
请选择 (输入数字): 1
```

## 高级用法

### 1. 动态配置

```typescript
// 运行时启用/禁用交互模式
agent.setInteractiveMode(true);

// 检查交互模式状态
const isInteractive = agent.isInteractiveMode();

// 获取交互统计
const stats = agent.getInteractiveStats();
console.log('已询问问题数:', stats.questionsAsked);
```

### 2. 直接交互

```typescript
// 直接询问用户问题
const answer = await agent.askUserQuestion(
  '您希望使用哪个工具?',
  ['文件读取', '系统信息', 'HTTP请求']
);

// 确认特定操作
const confirmed = await agent.confirmAction('是否要删除该文件?');

// 澄清任务描述
const clarified = await agent.clarifyTask(
  '处理数据',
  '您想要如何处理数据?'
);
```

### 3. 多媒体处理

```typescript
// 图像分析
const imageResult = await agent.executeTask('分析这张图片中的内容');

// 图像生成
const generatedImage = await agent.executeTask('生成一张美丽的日落图片');

// 视频生成
const videoResult = await agent.executeTask('生成一个展示猫咪的短视频');
```

## 内置工具

### 文件操作
- `file_write`: 写入文件
- `file_read`: 读取文件
- `file_delete`: 删除文件
- `file_list`: 列出文件

### 系统操作
- `system_info`: 获取系统信息
- `command_execute`: 执行命令

### 网络操作
- `http_get`: GET 请求
- `http_post`: POST 请求
- `http_request`: 通用 HTTP 请求

### 多媒体操作
- `image_analysis`: 图像分析
- `image_generation`: 图像生成
- `ocr`: OCR 文字识别
- `video_generation`: 视频生成
- `video_analysis`: 视频分析
- `video_script`: 视频脚本生成

## 配置选项详解

### 存储配置
```typescript
storage: {
  type: 'json' | 'sqlite',     // 存储类型
  dataDir: string,            // 数据目录
  backupEnabled: boolean,     // 启用备份
  backupInterval: number      // 备份间隔
}
```

### 安全配置
```typescript
security: {
  enablePermissions: boolean,  // 启用权限检查
  allowedTools: string[],     // 允许的工具列表
  maxTaskDuration: number,   // 最大任务时长
  safeMode: boolean         // 安全模式
}
```

### 交互式配置
```typescript
interactive: {
  enabled: boolean,                    // 是否启用交互
  confirmBeforeExecution: boolean,     // 执行前确认
  askForClarification: boolean,        // 需要澄清时询问
  maxQuestions: number               // 最大询问次数
}
```

## 实际应用场景

### 1. 自动化脚本
```typescript
// 自动化部署脚本
const deployTask = `
  1. 检查系统环境
  2. 拉取最新代码
  3. 安装依赖
  4. 运行测试
  5. 部署应用
`;

const result = await agent.executeTask(deployTask);
```

### 2. 数据处理
```typescript
// 数据处理管道
const dataProcessing = `
  读取数据文件 data.csv
  分析数据结构
  清洗无效数据
  生成统计报告
  保存结果到 report.json
`;

const result = await agent.executeTask(dataProcessing);
```

### 3. 系统管理
```typescript
// 系统维护任务
const maintenance = `
  检查磁盘空间
  清理临时文件
  检查系统更新
  生成系统报告
`;

const result = await agent.executeTask(maintenance);
```

## 最佳实践

### 1. 配置建议
- 生产环境启用 `safeMode`
- 设置合理的 `maxTaskDuration`
- 使用具体的工具权限
- 启用日志记录

### 2. 交互式使用
- 在复杂任务中启用交互模式
- 设置合理的 `maxQuestions`
- 提供清晰的选项描述
- 处理用户取消的情况

### 3. 错误处理
```typescript
try {
  const result = await agent.executeTask(task);
  if (!result.success) {
    console.error('任务失败:', result.error);
  }
} catch (error) {
  console.error('执行异常:', error);
} finally {
  await agent.shutdown();
}
```

## 故障排除

### 常见问题
1. **权限错误**: 检查 `allowedTools` 配置
2. **超时错误**: 增加 `maxTaskDuration` 或优化任务
3. **LLM 调用失败**: 检查 API 密钥和网络连接
4. **交互无响应**: 确保在支持交互的环境中运行

### 调试技巧
- 启用 `debug` 级别日志
- 使用 `healthCheck()` 检查系统状态
- 查看 `getStats()` 获取运行统计
- 使用快速测试模式 `test:fast`

## 示例代码

运行预置示例：

```bash
# 基础示例
pnpm example:basic

# 交互式示例
pnpm example:interactive

# 文件操作示例
pnpm example:files

# HTTP 请求示例
pnpm example:http

# 多媒体功能示例
pnpm example:multimedia
```

这个指南涵盖了 TsAgent 的所有主要功能和使用场景。根据您的具体需求，可以灵活配置和使用不同的功能组合。