# Shared Frontend Package

这个包包含了在多个前端模块间共享的工具和组件。

## 使用方法

### 在前端基座项目中使用

```typescript
// 导入共享工具
import { buildNestedTree, type RouteNode, type RouteTree } from '@tsfullstack/shared-frontend/utils';
import { type ModuleFrontendConfig } from '@tsfullstack/shared-frontend/types';
```

### 在模块模板中使用

```typescript
// 在 module-template 中引用共享工具
import { buildNestedTree } from '@tsfullstack/shared-frontend/utils';
import { type ModuleFrontendConfig } from '@tsfullstack/shared-frontend/types';
```

## 架构优势

1. **避免循环依赖**: 通过独立的共享包，避免了 module-template 和 frontend 基座之间的循环依赖
2. **类型安全**: 提供完整的 TypeScript 类型支持
3. **可复用性**: 共享的工具和组件可以在多个项目中复用
4. **维护性**: 集中管理共享代码，便于维护和更新

## 包结构

```
src/
├── index.ts          # 主入口文件
├── utils/            # 工具函数
│   ├── index.ts
│   └── routeUtil.ts  # 路由工具
├── types/            # 类型定义
│   └── index.ts
└── components/       # 共享组件
    └── index.ts
```