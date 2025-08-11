# TsAgent - 轻量级通用 Agent 系统 PRD

## 1. 产品概述

### 1.1 产品愿景
构建一个轻量级、独立的 TypeScript Agent 系统，能够自动处理用户提交的任务、自动验证执行结果、自动修复错误，并提供灵活的工具扩展能力。系统设计简洁，可独立运行，无需复杂的框架依赖。

### 1.2 核心价值主张
- **轻量级**: 最小化依赖，快速启动，低资源消耗
- **自动化任务处理**: Agent 能够自主理解、执行和验证任务
- **自我修复能力**: 自动检测执行失败并进行修复
- **插件化工具系统**: 开发者可以轻松添加自定义工具
- **独立运行**: 不依赖特定框架，可在任何 Node.js 环境中运行
- **简单安全**: 内置基础权限校验和操作记录

### 1.3 目标用户
- **主要用户**: 开发者，需要自动化处理编程任务
- **次要用户**: 系统管理员，需要自动化运维任务
- **潜在用户**: 个人开发者和小团队，需要轻量级自动化解决方案

## 2. 产品架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────┐
│                      TsAgent 核心                              │
├─────────────────────────────────────────────────────────────────┤
│  任务管理器 (TaskManager)                                       │
│  ├── 任务解析 (TaskParser)                                     │
│  ├── 工具选择 (ToolSelector)                                   │
│  ├── 执行引擎 (ExecutionEngine)                                │
│  ├── 结果验证 (ResultValidator)                                │
│  └── 错误处理 (ErrorHandler)                                   │
├─────────────────────────────────────────────────────────────────┤
│  工具系统 (ToolSystem)                                         │
│  ├── 工具注册表 (ToolRegistry)                                 │
│  ├── 权限管理 (PermissionManager)                             │
│  └── 工具执行器 (ToolExecutor)                                 │
├─────────────────────────────────────────────────────────────────┤
│  存储层 (Storage Layer)                                        │
│  ├── 任务存储 (TaskStorage)                                    │
│  ├── 工具存储 (ToolStorage)                                    │
│  └── 日志存储 (LogStorage)                                     │
├─────────────────────────────────────────────────────────────────┤
│  配置层 (Config Layer)                                         │
│  ├── 系统配置 (SystemConfig)                                   │
│  ├── 权限配置 (PermissionConfig)                               │
│  └── 工具配置 (ToolConfig)                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块

#### 2.2.1 任务管理器
- **任务解析**: 解析用户输入的自然语言任务
- **工具选择**: 根据任务需求选择合适的工具
- **执行引擎**: 协调工具的执行顺序
- **结果验证**: 验证执行结果是否符合预期
- **错误处理**: 自动处理执行过程中的错误

#### 2.2.2 工具系统
- **工具注册表**: 管理所有可用工具
- **权限管理**: 基础的工具权限验证
- **工具执行器**: 执行具体的工具操作

#### 2.2.3 存储层
- **任务存储**: 任务和执行记录的持久化
- **工具存储**: 工具定义和元数据存储
- **日志存储**: 操作日志和执行记录

#### 2.2.4 配置层
- **系统配置**: Agent 的基础配置
- **权限配置**: 工具权限规则配置
- **工具配置**: 工具特定配置

## 3. 功能特性

### 3.1 任务处理流程
1. **任务接收**: 接收用户提交的自然语言任务
2. **任务分析**: 理解任务目标，识别所需工具
3. **计划制定**: 生成详细的执行步骤
4. **权限检查**: 验证用户是否有权限执行所需操作
5. **任务执行**: 按照计划执行各步骤
6. **结果验证**: 验证执行结果是否达到预期
7. **错误处理**: 如果失败，自动尝试修复策略
8. **结果返回**: 返回执行结果和详细报告

### 3.2 自动验证机制
- **结果断言**: 验证文件是否存在、内容是否正确
- **状态检查**: 检查系统状态是否符合预期
- **性能验证**: 验证执行时间、资源使用是否合理
- **安全检查**: 验证操作是否符合安全策略

### 3.3 自动修复能力
- **重试机制**: 针对临时性错误自动重试
- **策略调整**: 根据错误类型调整执行策略
- **回滚操作**: 失败时自动回滚到之前状态
- **求助机制**: 无法修复时向用户请求指导

### 3.4 工具系统特性
- **插件化架构**: 工具可以作为独立模块开发和注册
- **类型安全**: 完整的 TypeScript 类型定义
- **权限控制**: 每个工具都有独立的权限配置
- **版本管理**: 支持工具版本控制和回滚
- **执行监控**: 实时监控工具执行状态

## 4. 技术实现

### 4.1 技术栈
- **语言**: TypeScript
- **运行时**: Node.js >= 18
- **存储**: SQLite (本地文件) 或 JSON 文件存储
- **依赖**: 最小化外部依赖，仅使用必要的库
- **构建**: tsup 或 tsc
- **包管理**: npm 或 pnpm

### 4.2 数据模型设计
```typescript
// 任务数据模型
interface Task {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: TaskStep[];
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

interface TaskStep {
  id: string;
  toolName: string;
  input: any;
  output?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

// 工具定义模型
interface ToolDefinition {
  name: string;
  description: string;
  version: string;
  inputSchema: any;
  outputSchema?: any;
  permissions: string[];
  execute: (input: any) => Promise<any>;
  validate?: (input: any) => boolean;
  timeout?: number;
}

// 权限模型
interface Permission {
  toolName: string;
  requiredPermissions: string[];
  maxRetries?: number;
  timeout?: number;
  allowedEnvironments?: string[];
}

// 配置模型
interface AgentConfig {
  storage: {
    type: 'json' | 'sqlite';
    path?: string;
  };
  security: {
    enablePermissions: boolean;
    allowedTools: string[];
    maxTaskDuration: number;
    safeMode: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableFile: boolean;
    logPath?: string;
  };
  tools: {
    directory: string;
    autoLoad: boolean;
    timeout: number;
  };
}
```

### 4.3 核心类设计
```typescript
// 核心 Agent 类
class TsAgent {
  private config: AgentConfig;
  private taskManager: TaskManager;
  private toolRegistry: ToolRegistry;
  private storage: Storage;
  private logger: Logger;

  constructor(config: AgentConfig) {
    this.config = config;
    this.storage = new Storage(config.storage);
    this.logger = new Logger(config.logging);
    this.toolRegistry = new ToolRegistry(config.tools);
    this.taskManager = new TaskManager(this.toolRegistry, this.storage, this.logger);
  }

  async executeTask(description: string): Promise<Task> {
    return this.taskManager.executeTask(description);
  }

  async registerTool(tool: ToolDefinition): Promise<void> {
    return this.toolRegistry.register(tool);
  }

  async getTaskStatus(taskId: string): Promise<Task | null> {
    return this.storage.getTask(taskId);
  }
}

// 任务管理器
class TaskManager {
  private toolRegistry: ToolRegistry;
  private storage: Storage;
  private logger: Logger;

  constructor(toolRegistry: ToolRegistry, storage: Storage, logger: Logger) {
    this.toolRegistry = toolRegistry;
    this.storage = storage;
    this.logger = logger;
  }

  async executeTask(description: string): Promise<Task> {
    const task = await this.createTask(description);
    await this.storage.saveTask(task);

    try {
      const steps = await this.planSteps(description);
      await this.executeSteps(task.id, steps);
      await this.validateResult(task.id);
      return await this.storage.getTask(task.id);
    } catch (error) {
      await this.handleTaskError(task.id, error);
      throw error;
    }
  }

  private async createTask(description: string): Promise<Task> {
    return {
      id: generateId(),
      description,
      status: 'pending',
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async planSteps(description: string): Promise<PlannedStep[]> {
    // 使用简单的规则或LLM来规划任务步骤
    return [];
  }

  private async executeSteps(taskId: string, steps: PlannedStep[]): Promise<void> {
    // 执行任务步骤
  }

  private async validateResult(taskId: string): Promise<void> {
    // 验证任务结果
  }

  private async handleTaskError(taskId: string, error: Error): Promise<void> {
    // 处理任务错误
  }
}

// 工具注册表
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async register(tool: ToolDefinition): Promise<void> {
    this.tools.set(tool.name, tool);
  }

  async execute(toolName: string, input: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    // 权限检查
    if (!this.checkPermission(toolName)) {
      throw new Error(`Permission denied for tool ${toolName}`);
    }

    // 输入验证
    if (tool.validate && !tool.validate(input)) {
      throw new Error(`Invalid input for tool ${toolName}`);
    }

    // 执行工具
    return this.safeExecute(tool, input);
  }

  private checkPermission(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) return false;

    // 简单的权限检查
    return this.config.allowedTools?.includes(toolName) ?? true;
  }

  private async safeExecute(tool: ToolDefinition, input: any): Promise<any> {
    const timeout = tool.timeout || this.config.timeout || 30000;

    return Promise.race([
      tool.execute(input),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      )
    ]);
  }

  getTool(toolName: string): ToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

// 存储管理器
class Storage {
  private config: any;
  private db?: any;

  constructor(config: any) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.config.type === 'sqlite') {
      // 初始化 SQLite
    } else {
      // 使用 JSON 文件存储
    }
  }

  async saveTask(task: Task): Promise<void> {
    // 保存任务
  }

  async getTask(taskId: string): Promise<Task | null> {
    // 获取任务
    return null;
  }

  async getTasks(filter?: any): Promise<Task[]> {
    // 获取任务列表
    return [];
  }
}

// 日志管理器
class Logger {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  private log(level: string, message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    if (this.config.enableConsole) {
      console.log(JSON.stringify(logEntry));
    }

    if (this.config.enableFile && this.config.logPath) {
      // 写入文件
    }
  }
}
```

### 4.4 工具定义示例
```typescript
// 文件写入工具
const fileWriteTool: ToolDefinition = {
  name: 'file_write',
  description: 'Write content to a file',
  version: '1.0.0',
  permissions: ['file_write'],
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
      encoding: { type: 'string', enum: ['utf8', 'base64'], default: 'utf8' }
    },
    required: ['path', 'content']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      path: { type: 'string' }
    }
  },
  timeout: 10000,
  validate: (input) => {
    return typeof input.path === 'string' &&
           typeof input.content === 'string' &&
           !input.path.includes('..'); // 防止路径遍历
  },
  execute: async (input) => {
    const fs = require('fs').promises;
    const path = require('path');

    // 安全检查：确保路径在允许的目录内
    const safePath = path.resolve(input.path);
    const allowedDirs = ['/tmp', './workspace'];

    if (!allowedDirs.some(dir => safePath.startsWith(dir))) {
      throw new Error('Access denied: path outside allowed directories');
    }

    await fs.writeFile(safePath, input.content, input.encoding || 'utf8');

    return {
      success: true,
      message: 'File written successfully',
      path: safePath
    };
  }
};

// 命令执行工具
const commandExecuteTool: ToolDefinition = {
  name: 'command_execute',
  description: 'Execute shell commands safely',
  version: '1.0.0',
  permissions: ['command_execute'],
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string' },
      args: { type: 'array', items: { type: 'string' } },
      cwd: { type: 'string' },
      timeout: { type: 'number', default: 30000 }
    },
    required: ['command']
  },
  outputSchema: {
    type: 'object',
    properties: {
      stdout: { type: 'string' },
      stderr: { type: 'string' },
      exitCode: { type: 'number' },
      success: { type: 'boolean' }
    }
  },
  timeout: 60000,
  validate: (input) => {
    const dangerousCommands = ['rm -rf', 'format', 'del', '> /dev/null'];
    const cmd = input.command.toLowerCase();

    return !dangerousCommands.some(dangerous => cmd.includes(dangerous));
  },
  execute: async (input) => {
    const { execSync } = require('child_process');

    try {
      const stdout = execSync(`${input.command} ${input.args?.join(' ') || ''}`, {
        cwd: input.cwd,
        timeout: input.timeout || 30000,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 // 1MB
      });

      return {
        stdout,
        stderr: '',
        exitCode: 0,
        success: true
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.status || 1,
        success: false
      };
    }
  }
};

// HTTP 请求工具
const httpRequestTool: ToolDefinition = {
  name: 'http_request',
  description: 'Make HTTP requests',
  version: '1.0.0',
  permissions: ['http_request'],
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
      headers: { type: 'object' },
      body: { type: 'string' },
      timeout: { type: 'number', default: 10000 }
    },
    required: ['url']
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'number' },
      headers: { type: 'object' },
      body: { type: 'string' },
      success: { type: 'boolean' }
    }
  },
  timeout: 15000,
  validate: (input) => {
    try {
      new URL(input.url);
      return true;
    } catch {
      return false;
    }
  },
  execute: async (input) => {
    const https = require('https');
    const http = require('http');

    return new Promise((resolve, reject) => {
      const url = new URL(input.url);
      const client = url.protocol === 'https:' ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: input.method || 'GET',
        headers: input.headers || {},
        timeout: input.timeout || 10000
      };

      const req = client.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        });
      });

      req.on('error', (error: any) => {
        resolve({
          status: 0,
          headers: {},
          body: error.message,
          success: false
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 0,
          headers: {},
          body: 'Request timeout',
          success: false
        });
      });

      if (input.body) {
        req.write(input.body);
      }

      req.end();
    });
  }
};
```

## 5. 安全设计

### 5.1 轻量级权限模型
- **基于配置的权限**: 通过配置文件管理工具权限
- **工具白名单**: 只允许执行配置中允许的工具
- **简单权限规则**: 基础的权限验证机制
- **运行时检查**: 执行前进行权限验证

### 5.2 基础安全措施
- **输入验证**: 所有工具输入都经过严格验证
- **路径安全**: 防止路径遍历攻击
- **命令过滤**: 过滤危险的系统命令
- **超时控制**: 限制工具执行时间
- **资源限制**: 限制输出缓冲区大小

### 5.3 简单隔离机制
- **工作目录限制**: 限制文件操作的目录范围
- **命令白名单**: 只允许执行安全的命令
- **URL 验证**: 验证 HTTP 请求的目标地址
- **输出限制**: 限制返回数据的大小

## 6. 开发者体验

### 6.1 快速开始
```typescript
// 安装
npm install @tsagent/core

// 使用
import { TsAgent } from '@tsagent/core';

// 创建 Agent 实例
const agent = new TsAgent({
  storage: { type: 'json', path: './data' },
  security: {
    enablePermissions: true,
    allowedTools: ['file_write', 'command_execute'],
    safeMode: true
  },
  logging: {
    level: 'info',
    enableConsole: true,
    enableFile: false
  },
  tools: {
    directory: './tools',
    autoLoad: true,
    timeout: 30000
  }
});

// 执行任务
const result = await agent.executeTask('创建一个名为 test.txt 的文件，内容为 "Hello World"');
console.log(result);
```

### 6.2 工具开发
```typescript
// 自定义工具示例
import { ToolDefinition } from '@tsagent/core';

const calculatorTool: ToolDefinition = {
  name: 'calculator',
  description: 'Simple calculator',
  version: '1.0.0',
  permissions: ['calculator'],
  inputSchema: {
    type: 'object',
    properties: {
      expression: { type: 'string' }
    },
    required: ['expression']
  },
  outputSchema: {
    type: 'object',
    properties: {
      result: { type: 'number' }
    }
  },
  validate: (input) => {
    // 只允许简单的数学表达式
    return /^[0-9+\-*/\s()]+$/.test(input.expression);
  },
  execute: async (input) => {
    // 安全的计算表达式
    const result = Function('"use strict"; return (' + input.expression + ')')();
    return { result };
  }
};

// 注册工具
await agent.registerTool(calculatorTool);
```

### 6.3 配置文件
```json
// tsagent.config.json
{
  "storage": {
    "type": "json",
    "path": "./data"
  },
  "security": {
    "enablePermissions": true,
    "allowedTools": ["file_write", "command_execute", "http_request"],
    "safeMode": true,
    "maxTaskDuration": 300000
  },
  "logging": {
    "level": "info",
    "enableConsole": true,
    "enableFile": true,
    "logPath": "./logs/agent.log"
  },
  "tools": {
    "directory": "./tools",
    "autoLoad": true,
    "timeout": 30000
  }
}
```

### 6.4 调试和监控
- **控制台日志**: 实时显示执行状态
- **任务历史**: 保存任务执行记录
- **错误追踪**: 详细的错误信息
- **性能统计**: 执行时间和成功率统计

## 7. 部署和运维

### 7.1 部署要求
- **Node.js**: >= 18.0.0
- **内存**: 最小 128MB，推荐 512MB
- **存储**: 最小 50MB，推荐 1GB
- **操作系统**: Linux、macOS、Windows

### 7.2 快速部署
```bash
# 1. 安装依赖
npm install @tsagent/core

# 2. 创建配置文件
cp node_modules/@tsagent/core/tsagent.config.json.example ./tsagent.config.json

# 3. 创建启动脚本
echo "import { TsAgent } from '@tsagent/core';
const agent = new TsAgent(require('./tsagent.config.json'));
agent.executeTask(process.argv[2]).then(console.log).catch(console.error);" > agent.js

# 4. 运行
node agent.js "创建一个测试文件"
```

### 7.3 监控
- **日志文件**: 所有操作记录到日志文件
- **任务状态**: 通过 API 查询任务状态
- **性能指标**: 简单的执行统计
- **错误报告**: 错误汇总和分析

### 7.4 扩展性
- **自定义工具**: 支持添加任意工具
- **存储后端**: 支持 JSON 文件和 SQLite
- **配置热重载**: 支持配置文件热重载
- **插件系统**: 支持动态加载工具

## 8. 发展路线图

### 8.1 MVP 版本 (v1.0)
- [ ] 基础任务处理框架
- [ ] 简单工具系统
- [ ] 基础权限管理
- [ ] 文件操作工具
- [ ] 命令执行工具
- [ ] HTTP 请求工具
- [ ] JSON 文件存储

### 8.2 v1.1 - 增强功能
- [ ] 更智能的任务解析
- [ ] 工具超时控制
- [ ] 错误重试机制
- [ ] 配置热重载
- [ ] 更详细的日志

### 8.3 v1.2 - 高级特性
- [ ] 任务模板系统
- [ ] 批量任务处理
- [ ] 简单的 Web 管理界面
- [ ] 性能监控面板
- [ ] 插件市场
- [ ] 工具版本管理

## 9. 风险和挑战

### 9.1 技术风险
- **安全性**: 工具执行的安全性保障
- **稳定性**: 系统的稳定性和错误处理
- **性能**: 大量任务的执行效率
- **兼容性**: 不同平台的兼容性

### 9.2 业务风险
- **采用率**: 开发者对轻量级方案的接受度
- **维护**: 长期维护的成本和资源
- **竞争**: 类似自动化工具的竞争
- **标准化**: 缺乏行业标准

### 9.3 缓解措施
- **安全优先**: 严格的安全验证和测试
- **简单设计**: 保持系统简单易懂
- **社区驱动**: 积极建设开发者社区
- **文档完善**: 提供详细的文档和示例

## 10. 成功指标

### 10.1 技术指标
- 启动时间 < 3秒
- 内存占用 < 100MB
- 任务执行成功率 > 90%
- 平均任务执行时间 < 10秒

### 10.2 用户指标
- 安装量 > 1000/月
- 工具采用率 > 60%
- 用户满意度 > 4.0/5
- 文档访问量 > 5000/月

### 10.3 开发指标
- 代码覆盖率 > 80%
- 问题响应时间 < 24小时
- 发布周期 < 2周/版本
- 贡献者数量 > 10

## 11. 总结

TsAgent 是一个轻量级、独立的 TypeScript Agent 系统，专注于提供简单、安全、可扩展的自动化能力。

### 核心优势：
1. **轻量级**: 最小依赖，快速启动，低资源消耗
2. **简单易用**: 直观的 API 和配置，快速上手
3. **安全可靠**: 基础安全措施，防止滥用
4. **高度可扩展**: 灵活的工具系统，支持自定义
5. **独立运行**: 不依赖特定框架，可在任何 Node.js 环境运行

### 目标用户：
- 个人开发者和小团队
- 需要轻量级自动化解决方案的用户
- 希望快速集成自动化能力的项目

TsAgent 填补了市场上轻量级 Agent 系统的空白，为开发者提供了一个既强大又简单的自动化工具，让每个人都能轻松享受自动化带来的效率提升。