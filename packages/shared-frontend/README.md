# Shared Frontend Package

这个包包含了在多个前端模块间共享的工具和组件。

## 使用方法

### 在前端基座项目中使用

```typescript
// 导入共享工具
import {
  buildNestedTree,
  type RouteNode,
  type RouteTree,
} from "@tsfullstack/shared-frontend/utils";
import { type ModuleFrontendConfig } from "@tsfullstack/shared-frontend/types";
```

### 在模块模板中使用

```typescript
// 在 module-template 中引用共享工具
import { buildNestedTree } from "@tsfullstack/shared-frontend/utils";
import { type ModuleFrontendConfig } from "@tsfullstack/shared-frontend/types";
```

## 架构优势

1. **避免循环依赖**: 通过独立的共享包，避免了 module-template 和 frontend 基座之间的循环依赖
2. **类型安全**: 提供完整的 TypeScript 类型支持
3. **可复用性**: 共享的工具和组件可以在多个项目中复用
4. **维护性**: 集中管理共享代码，便于维护和更新

## 组件开发规范（强制）

> 完整规范见根目录 `CLAUDE.md` 的「组件库规范（强制）」，此处为组件相关要点：

- **无头层**基于 `reka-ui` primitives 封装，样式层只做 Tailwind 类组合，颜色用 `@theme` 的 OKLCH 变量
- **新建/修改任何组件必须在展示页添加展示区块**：`apps/website-frontend/src/pages/components/ComponentShowcase.vue`（路由 `/components`），并在浏览器中实际验证渲染、交互、dark 模式与控制台无警告
- 不要在 props 里声明 `class`（交给 attrs 自动透传）；响应式数据禁止写入非响应式结构；**禁止空实现**（空目录/空文件不得进入 `index.ts` 导出清单）

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
