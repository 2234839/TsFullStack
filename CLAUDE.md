## 项目概述

TsFullStack 是一个 TypeScript 全栈框架，支持前端直接操作数据库，无需编写后端 API 代码。

### 核心技术栈
- **后端**: TypeScript + Prisma + ZenStack + Effect + Fastify
- **前端**: TypeScript + Vue 3 + Tailwind CSS + reka-ui（自定义组件库）
- **浏览器扩展**: WXT + Vue 3 + Tailwind CSS + PrimeVue

**✅ PrimeVue 已完全移除** - website-frontend 已完成从 PrimeVue 到自定义组件库的迁移

### 开发工作流

```bash
# 后端开发 (apps/backend/)
pnpm zenstack generate    # 生成 Prisma 客户端
pnpm prisma migrate dev   # 运行数据库迁移
pnpm build:lib            # 构建后端api接口包供前端掉用
pnpm dev                  # 启动开发服务器

# 编译构建tsfullstack网站和后端并发布到服务器
pnpm --filter @tsfullstack/backend build:publish

# 前端开发 (apps/website-frontend/)
pnpm build                # 构建生产版本
pnpm tsc                  # 类型检查

# 浏览器扩展 (apps/InfoFlow/)
pnpm dev                  # 启动开发服务器
pnpm build                # 构建扩展
```
### [Shared Frontend Package](packages/shared-frontend)
这个子包提供在多个前端模块间共享的工具和组件

### 重要说明

**数据库管理**
- 修改模型定义使用 `schema.zmodel` 而不是 `prisma/schema.prisma`（基于前者自动生成）
- 修改 schema 后必须运行 `pnpm zenstack generate`

**类型安全**
- 项目强调严格的 TypeScript 类型检查
- 避免使用 `any` 类型
- 后端需要构建为库 (`pnpm build:lib`) 供前端导入类型

**架构特性**
- ZenStack: 声明式访问控制和行级安全
- RPC 系统: 前端直接调用后端 API，完整类型安全
- Effect: 函数式编程的错误处理和依赖注入

## 前端开发规范

### 🎨 颜色系统使用规范

**本项目使用统一的语义化颜色系统，所有新代码必须遵循此规范。**

#### 颜色配置位置
配置文件：[tailwind.config.ts](apps/website-frontend/tailwind.config.ts)
详细指南：[COLOR_GUIDE.md](apps/website-website-frontend/COLOR_GUIDE.md)

#### 必须使用的语义化颜色

tailwind 配置了 primary secondary success warning danger info 这几个语义化的 colors 取值范围均为 50 100 200 300 400 500 600 700 800 900 950
```
正确：使用语义化颜色
class="bg-primary-600 hover:bg-primary-700"
错误：不要使用硬编码颜色
 class="bg-blue-600"
```

#### 颜色系统说明

**主色调**
- 用途：主要操作、主按钮、链接、品牌色
- 特点：青绿色系，清新专业，类似 GitHub/Linear 风格

**辅助色**
- 用途：次要操作、次要按钮、补充信息
- 特点：靛蓝色系，沉稳专业

#### 明暗模式支持

所有颜色必须支持明暗模式：

```html
<!-- 文本色 -->
<div class="text-gray-900 dark:text-gray-100">标题</div>
<div class="text-gray-600 dark:text-gray-400">正文</div>

<!-- 背景色 -->
<div class="bg-white dark:bg-gray-800">卡片</div>
<div class="bg-gray-50 dark:bg-gray-900">页面背景</div>

<!-- 边框色 -->
<div class="border-gray-200 dark:border-gray-700">边框</div>
```

#### 组件开发要求

**新开发的组件必须使用语义化颜色：**

```vue
<!-- 好的做法 -->
<button
  :class="{
    'bg-primary-600 hover:bg-primary-700': variant === 'primary',
    'bg-secondary-600 hover:bg-secondary-700': variant === 'secondary',
    'bg-success-600 hover:bg-success-700': variant === 'success',
    'bg-danger-600 hover:bg-danger-700': variant === 'danger',
  }"
>
  <slot></slot>
</button>
```