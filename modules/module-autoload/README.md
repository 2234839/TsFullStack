# Module Autoload

TsFullStack 的自动模块加载系统，能够自动发现、构建和聚合所有模块，提供一个统一的入口点来访问所有模块的 API 和前端组件。

## 🚀 功能特性

- **自动发现模块**: 扫描 `modules/` 目录下的所有模块
- **增量编译**: 使用 Turbo 进行智能增量构建
- **依赖管理**: 自动解析和更新 workspace 依赖
- **聚合导出**: 生成统一的 API 和前端聚合入口
- **类型安全**: 完整的 TypeScript 类型支持
- **多格式输出**: 支持 ES modules 和 CommonJS

## 📦 使用方式

### 1. 自动化构建（推荐）

```bash
# 从项目根目录执行
pnpm build:autoload

# 或者从模块目录执行
cd modules/module-autoload
pnpm automate
```

### 2. 手动构建

```bash
cd modules/module-autoload

# 构建依赖模块
pnpm prebuild

# 生成聚合代码
pnpm generate

# 构建自身
pnpm build
```

### 生成的文件

构建完成后会在 `dist` 目录下生成以下文件：

```
dist/
├── index.js          # 主入口文件
├── index.d.ts        # 主类型定义
├── api.js            # API 聚合
├── api.d.ts          # API 类型定义
├── frontend.js       # 前端聚合
├── frontend.d.ts     # 前端类型定义
├── vue-plugin.js     # Vue 插件
├── vue-plugin.d.ts   # Vue 插件类型
└── api-types.d.ts    # API 类型定义
```

## 在项目中使用

### 后端使用 API

```typescript
import { api } from '@tsfullstack/module-autoload/api';

// 使用任意模块的 API
api.moduleTemplate.test();
```

### 前端使用组件

```typescript
// 安装 Vue 插件
import { createApp } from 'vue';
import moduleAutoload from '@tsfullstack/module-autoload';

const app = createApp(App);
app.use(moduleAutoload);

// 直接导入组件
import { HelloWorld } from '@tsfullstack/module-autoload/frontend';
```

## 模块结构要求

为了被自动发现，模块必须遵循以下结构：

```
modules/your-module/
├── package.json       # 必须包含 name 和 version
├── api/              # 可选，如果提供则会被聚合
│   └── index.ts
└── frontend/         # 可选，如果提供则会被聚合
    └── index.ts
```

## 配置选项

可以通过环境变量或配置文件自定义行为：

- `MODULE_AUTOLOAD_EXCLUDE`: 排除的模块列表（逗号分隔）
- `MODULE_AUTOLOAD_OUTPUT`: 输出目录（默认：./dist）
- `MODULE_AUTOLOAD_FORMAT`: 输出格式（esm/cjs/both，默认：both）

## 开发

```bash
# 类型检查
pnpm typecheck

# 清理构建文件
pnpm clean
```