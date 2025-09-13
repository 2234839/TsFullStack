# @tsfullstack/module-loader

自动模块发现和聚合工具，用于 TsFullStack 框架的模块化管理。

## 🌟 特性

- 🔍 **自动发现** - 扫描 `modules/` 目录，自动识别所有有效模块
- 📦 **依赖管理** - 自动更新 backend 和 frontend 的 package.json 依赖
- 📄 **聚合生成** - 自动生成前后端聚合的 TypeScript 文件
- 🔄 **实时监听** - 监听模块变化，自动重新处理
- 🛡️ **类型安全** - 完整的 TypeScript 支持
- 🎯 **Vue 支持** - 特殊处理 Vue 组件导出

## 📦 安装

该包是 TsFullStack 框架的一部分，会自动安装在 workspace 中。

```bash
# 如果需要单独安装
pnpm add @tsfullstack/module-loader
```

## 🚀 使用方法

#### 在项目根目录执行
```bash
pnpm modules:list        # 列出所有发现的模块
pnpm modules:run         # 运行完整模块加载流程
pnpm modules:install     # 安装/更新依赖并生成聚合文件
pnpm modules:watch       # 监听模式（自动响应变化）
pnpm modules:tsc         # 类型检查
```

#### 在任何子目录执行（使用 pnpm --workspace-root）
```bash
# 从任何子目录执行根级别命令
pnpm --workspace-root run modules:list
pnpm --workspace-root run modules:run
pnpm --workspace-root run modules:install
pnpm --workspace-root run modules:watch
pnpm --workspace-root run modules:tsc

# 示例：从 apps/backend 目录执行
cd apps/backend
pnpm --workspace-root run modules:run

# 示例：从 modules/user-management 目录执行
cd modules/user-management
pnpm --workspace-root run modules:install
```

#### 直接使用 CLI
```bash
# 从项目根目录使用
node packages/module-loader/dist/cli.js list

# 从任何位置使用（需要指定根目录）
node packages/module-loader/dist/cli.js run --root /path/to/project
```

## 📁 项目结构

```
modules/
├── module-template/           # 模块模板
│   ├── package.json           # 模块配置
│   ├── index.ts               # 主入口
│   ├── backend/               # 后端代码
│   │   ├── index.ts
│   │   └── utils.ts
│   └── frontend/              # 前端代码
│       ├── index.ts
│       └── vue.ts             # Vue 组件
└── your-module/              # 你的自定义模块
    ├── package.json
    ├── backend/
    └── frontend/
```

## 🔧 模块开发

### 创建新模块

1. **创建模块目录**
```bash
mkdir -p modules/your-module
```

2. **创建 package.json**
```json
{
  "name": "@tsfullstack/your-module",
  "version": "1.0.0",
  "description": "Your module description",
  "type": "module",
  "main": "./index.ts",
  "module": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": {
      "types": "./index.ts",
      "default": "./index.ts"
    },
    "./backend": {
      "types": "./backend/index.ts",
      "default": "./backend/index.ts"
    },
    "./frontend": {
      "types": "./frontend/index.ts",
      "default": "./frontend/index.ts"
    }
  }
}
```

3. **创建模块文件**
```typescript
// index.ts
export const name = '@tsfullstack/your-module';
export const version = '1.0.0';

// backend/index.ts
export const backendFunctions = {
  hello: () => 'Hello from backend!'
};

// frontend/index.ts
export const frontendFunctions = {
  hello: () => 'Hello from frontend!'
};
```

4. **运行模块加载器**
```bash
pnpm modules:install
```

### 模块规范

#### 命名约定
- 模块名必须以 `@tsfullstack/` 开头
- 使用 kebab-case 命名，如 `@tsfullstack/user-management`

#### 目录结构
```
your-module/
├── package.json     # 必须包含 name, version
├── index.ts         # 主入口文件
├── backend/         # 后端代码（可选）
│   ├── index.ts
│   └── utils.ts     # 工具函数（可选）
└── frontend/        # 前端代码（可选）
    ├── index.ts
    └── vue.ts       # Vue 组件（可选）
```

#### Package.json 配置
```json
{
  "name": "@tsfullstack/your-module",
  "version": "1.0.0",
  "description": "Module description",
  "type": "module",
  "main": "./index.ts",
  "module": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": {
      "types": "./index.ts",
      "default": "./index.ts"
    },
    "./backend": {
      "types": "./backend/index.ts",
      "default": "./backend/index.ts"
    },
    "./frontend": {
      "types": "./frontend/index.ts",
      "default": "./frontend/index.ts"
    }
  }
}
```

## 📋 生成的文件

模块加载器会在 `packages/module-loader/generated/` 目录下生成聚合文件：

### 后端聚合文件
```typescript
// backend.ts
import * as moduleTemplate from 'modules/module-template/backend';
import * as yourModule from 'modules/your-module/backend';

export { moduleTemplate, yourModule };
export const modules = {
  moduleTemplate,
  yourModule
};

// 工具函数
export async function initializeAllModules(): Promise<void> {
  // 初始化所有模块
}
```

### 前端聚合文件
```typescript
// frontend.ts
import * as moduleTemplate from 'modules/module-template/frontend';
import * as yourModule from 'modules/your-module/frontend';

export { moduleTemplate, yourModule };
export const modules = {
  moduleTemplate,
  yourModule
};
```

### Vue 组件聚合文件
```typescript
// frontend.vue.ts
import * as moduleTemplate from 'modules/module-template/frontend/vue';
import * as yourModule from 'modules/your-module/frontend/vue';

export { moduleTemplate, yourModule };
export const vueModules = {
  moduleTemplate,
  yourModule
};
```

## 🔧 配置选项

### CLI 选项
```bash
tsfullstack-modules run [options]

选项:
  -w, --watch          监听模式
  --root <dir>         项目根目录 (默认: 当前目录)
  --modules <dir>      模块目录 (默认: modules)
  --output <dir>       输出目录 (默认: packages/module-loader/generated)
  -h, --help           显示帮助
```

### 配置文件
可以在项目根目录创建 `module-loader.config.json` 文件：

```json
{
  "modulesDir": "modules",
  "outputDir": "packages/module-loader/generated",
  "targetPackages": [
    "apps/backend/package.json",
    "apps/website-frontend/package.json"
  ],
  "watch": false
}
```

## 🛠️ 开发

### 构建项目
```bash
pnpm build
```

### 类型检查
```bash
pnpm tsc
```

### 开发模式
```bash
pnpm dev
```

### 清理构建文件
```bash
pnpm clean
```

## 📝 示例

### 创建一个用户管理模块

1. **创建模块结构**
```bash
mkdir -p modules/user-management/{backend,frontend}
```

2. **创建 package.json**
```json
{
  "name": "@tsfullstack/user-management",
  "version": "1.0.0",
  "description": "User management module",
  "type": "module",
  "main": "./index.ts",
  "exports": {
    ".": "./index.ts",
    "./backend": "./backend/index.ts",
    "./frontend": "./frontend/index.ts"
  }
}
```

3. **实现模块功能**
```typescript
// index.ts
export const name = '@tsfullstack/user-management';

// backend/index.ts
export const userService = {
  create: (user: User) => { /* ... */ },
  update: (id: string, user: User) => { /* ... */ },
  delete: (id: string) => { /* ... */ },
  find: (id: string) => { /* ... */ }
};

// frontend/index.ts
export const userStore = {
  users: [],
  fetchUsers: async () => { /* ... */ },
  createUser: async (user: User) => { /* ... */ }
};
```

4. **运行模块加载器**
```bash
pnpm modules:install
```

5. **在其他项目中使用**
```typescript
// 在 backend 中使用
import { userService } from '@tsfullstack/user-management/backend';

// 在 frontend 中使用
import { userStore } from '@tsfullstack/user-management/frontend';
```

## 🐛 故障排除

### 常见问题

#### 1. 模块不被发现
- 确保 `package.json` 文件存在且格式正确
- 确保模块名以 `@tsfullstack/` 开头
- 检查模块是否在 `modules/` 目录下

#### 2. 依赖更新失败
- 确保 `package.json` 有写入权限
- 检查目标包文件是否存在
- 运行 `pnpm install` 修复依赖问题

#### 3. 聚合文件生成失败
- 检查输出目录权限
- 确保模块的导出文件存在
- 查看错误日志了解详细信息

### 调试模式

使用 `DEBUG` 环境变量获取详细日志：

```bash
DEBUG=module-loader:* pnpm modules:run
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

ISC License

## 🔗 相关链接

- [TsFullStack 框架](https://github.com/your-repo/tsfullstack)
- [模块模板](https://github.com/your-repo/tsfullstack/tree/main/modules/module-template)
- [后端应用](https://github.com/your-repo/tsfullstack/tree/main/apps/backend)
- [前端应用](https://github.com/your-repo/tsfullstack/tree/main/apps/website-frontend)