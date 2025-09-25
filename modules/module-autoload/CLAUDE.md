# Module Autoload 项目指南

## 🎯 项目目标

TsFullStack Module Autoload 系统的核心目标是：

1. **统一模块管理** - 提供单一入口点访问所有 TsFullStack 模块
2. **自动化构建流程** - 消除手动管理模块依赖的复杂性
3. **增量编译优化** - 使用 Turbo 实现智能增量构建
4. **类型安全保障** - 完整的 TypeScript 类型支持
5. **开发体验提升** - 简化模块使用和维护流程

## 🏗️ 架构设计

### 核心组件

- **模块发现器** (`src/discover.ts`) - 扫描和识别模块
- **依赖管理器** (`src/package-generator.ts`) - 管理 workspace 依赖
- **代码生成器** (`src/generate-api.ts`, `src/generate-frontend.ts`) - 生成聚合代码
- **自动化引擎** (`automate-build.ts`) - 协调整个构建流程
- **打包配置** (`vite.config.ts`) - 多入口点打包配置

### 工作流程

```
模块发现 → 依赖分析 → 增量构建 → 依赖更新 → 代码生成 → 最终打包
```

## 📋 实践规范

### 1. 模块命名约定

- 所有模块必须使用 `@tsfullstack/module-name` 格式
- `module-name` 应使用 kebab-case 命名
- 不得使用 `module-autoload` 作为模块名

### 2. 目录结构要求

```
modules/
├── module-name/
│   ├── package.json          # 必需：模块元数据
│   ├── api/                  # 可选：API 导出
│   │   └── index.ts
│   ├── frontend/             # 可选：前端组件导出
│   │   └── index.ts
│   └── src/                  # 源代码目录
└── module-autoload/          # 自动加载系统
```

### 3. Package.json 规范

```json
{
  "name": "@tsfullstack/module-name",
  "version": "0.1.0",
  "exports": {
    "./api": {
      "import": "./api/index.ts",
      "require": "./api/index.ts",
      "types": "./api/index.ts"
    },
    "./frontend": {
      "import": "./frontend/index.ts",
      "require": "./frontend/index.ts",
      "types": "./frontend/index.ts"
    }
  },
  "scripts": {
    "build": "构建命令",
    "build:lib": "库构建命令"
  }
}
```

### 4. API 导出规范

```typescript
// modules/module-name/api/index.ts
export const api = {
  // 导出的 API 函数
};

export type * from './types'; // 导出所有类型
```

### 5. 前端导出规范

```typescript
// modules/module-name/frontend/index.ts
export const components = {
  // 导出的组件
};

export type * from './types'; // 导出所有类型
```

## 🔧 开发流程

### 日常开发

1. **添加新模块** → 直接创建在 `modules/` 目录下
2. **构建系统** → 运行 `pnpm build:autoload`
3. **类型检查** → 运行 `pnpm tsc` 递归检查
4. **发布验证** → 运行完整构建流程

### 集成新模块

1. 遵循目录结构和命名规范
2. 实现 API 和/或前端导出
3. 配置 `package.json` 的 exports 字段
4. 添加构建脚本
5. 运行自动化构建验证

### 故障排除

1. **构建失败** → 检查模块结构和依赖
2. **类型错误** → 确保导出格式正确
3. **依赖冲突** → 验证 workspace 配置
4. **Turbo 失败** → 检查模块名称格式

## 🚀 使用指南

### 在项目中使用

```json
{
  "dependencies": {
    "@tsfullstack/module-autoload": "workspace:*"
  }
}
```

```typescript
// 统一入口
import { api, components } from '@tsfullstack/module-autoload';

// 专用入口
import { api } from '@tsfullstack/module-autoload/api';
import { components } from '@tsfullstack/module-autoload/frontend';
```

### 构建命令

```bash
# 完全自动化构建
pnpm build:autoload

# 模块目录内构建
cd modules/module-autoload && pnpm automate
```

## 📝 注意事项

1. **避免循环依赖** - 模块间不应该有循环引用
2. **保持向后兼容** - API 更新需要保持兼容性
3. **文档同步更新** - 新功能需要对应文档
4. **性能考虑** - 避免过度聚合影响加载性能
5. **测试覆盖** - 重要功能需要对应的测试

