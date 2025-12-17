# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在处理此代码库时提供指导。

## 项目概述

当前项目使用ts + vue3 + primevue组件库 + tailwindcss 进行开发。
帮用户解决问题时请考虑上述信息
当用户要求你生成代码的时候，请尽量仅输出代码，不要包含额外的解释。
注释应该采用 /** */ 的形式，而不是 //,注意对于对象的字段，应该直接在字段上方加注释，而非在对象上使用 jsdoc 语法为属性加注释

- Vite 作为构建工具
- 自定义 RPC 系统用于后端通信
## i18n
当前项目采用这种形式： $t('保存到云端,需要登录后才能使用')，注意里面的key就是中文,不用管i18n的翻译文案缺失，只需要使用这种形式来渲染所有文案即可

## 夜间模式适配
所有代码都应该要考虑到夜间适配可以直接使用 tailwindcs 的 dark 变体来适配

## 架构概述

### 核心组件

1. **路由系统** (`src/router.ts`) - 基于树结构的自定义路由，支持自动名称生成
2. **API 层** (`src/api.ts`) - 连接后端服务的自定义 RPC 系统
3. **组件结构** - 按功能组织的 Vue 单文件组件
5. **UI 组件** - 基于 PrimeVue 的 UI，在 `src/components/` 中有自定义组件
6. **国际化** - 在 `src/i18n/` 中实现的自定义 i18n

### 关键模式

1. **基于树的路由** - 路由在嵌套树结构中定义，并转换为 Vue Router 格式
2. **自定义 RPC 系统** - 通过类型化的 API 调用和自动序列化与后端通信
3. **组件自动导入** - 通过 unplugin-vue-components 自动导入 PrimeVue 组件
4. **Tailwind 与 PrimeVue** - 结合使用 Tailwind 和 PrimeVue 主题的混合样式方法，能使用 tailwind的就不要写css
5. **懒加载** - 通过动态导入懒加载路由组件

### 项目结构

```
src/
├── pages/          # 按功能组织的页面组件
├── components/     # 可复用的 UI 组件
├── api.ts          # 后端 API 集成
├── router.ts       # 应用程序路由
├── i18n/           # 国际化
├── storage/        # 客户端数据存储
├── utils/          # 工具函数
└── theme.ts        # 应用程序主题配置
```

### 路由操作

路由在 `src/router.ts` 中以树结构定义。添加新路由的步骤：
1. 在 `routeMap` 对象中添加新条目
2. 系统会自动处理名称生成和子路由转换

### API 集成

前端通过自定义 RPC 系统连接到后端：
import { useAPI } from '@/api'
const { API,AppAPI } = useAPI();

- `API` - 用于认证的系统 API
-  API.db 是对于prisma实例的安全包装(基于zenstack的RLS)，可以直接使用他来调用后端数据库，数据库建模文件在mono仓库的后端项目下： 与 CLAUDE.md 的相对路径是 [schema.zmodel](../backend/schema.zmodel) 所有涉及前端调用数据库的全部使用此对象
- `AppAPI` - 用于前端无需auth的 API
- 使用 SuperJSON 在客户端和服务器之间进行数据序列化

### 组件开发

- 直接使用 PrimeVue 组件（自动导入）
- 自定义组件应遵循 Vue 3 Composition API 模式
- 全局组件在 `src/main.ts` 中注册

#### **重要提示：始终使用 Reactive Props Destructure 形式定义组件 props**

Vue 3.5+ 支持响应式 props 解构，编译器会自动将解构的 prop 转换为 `props.xxx` 形式，保持响应式特性。

```typescript
interface Props {
  /** prop 描述 */
  propName?: string;
  /** 数字类型 prop，默认值为 42 */
  count?: number;
}

const {
  propName = 'default value',
  count = 42
} = defineProps<Props>();

// 在 watchEffect 中直接使用，Vue 会自动转换为 props.propName
watchEffect(() => {
  console.log(propName, count); // 自动转换为 props.propName, props.count
});
```
## 重要说明

- 项目使用 monorepo 结构，后端位于 `../backend/`
- API 类型从后端包导入以实现完全的类型安全
- 路由使用自定义的基于树的系统，而不是标准的 Vue Router 配置