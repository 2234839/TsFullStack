# TsFullStack

[English Document](./README.md) [中文文档](./README_zh.md)

---

这是我的 ts 全栈最佳实践项目。可以在定义数据模型后不用写后端接口代码即可前端直接操作数据库，快速开发 MVP 模型。

> 对于传统管理端页面我真的受够了，我再也不想写了。

[在线体验](http://tsfullstack.heartstack.space/)

https://deepwiki.com/2234839/TsFullStack

[文档地址](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## 特性

- 后端
  - 技术栈：ts + prisma + zenstack + Effect + fastify
  - zenstack（基于 prisma 的增强方案）来实现数据库建模和 Row Level Security 。

- 桥梁
  - 技术栈：ts + superjson + 自研 RPC 库
  - 前端直接调用后端 API 具有完整的 ts 类型提示，无需编写中间层代码。
  - superjson 支持复杂对象序列化和反序列化，如 Date、Map、Set、RegExp...,确保 primsa 的入参和返回结果可以无缝传递。

- 前端
  - 技术栈：ts + vue3 + tailwindcss + primevue 组件库
  - 尽善尽美的 i18n 国际化支持，确保每个细节都支持多语言动态切换而无需重载页面。
  - 明暗主题切换，组件和 tailwindcss 同步支持动态切换。
  - 实现的一些功能页面
   - 类 prisma studio 的管理面板（一定程度上可以作为他的开源替代方案），不再需要写千篇一律的 CRUD 页面。
   - [NoteCalc](https://tsfullstack.heartstack.space/noteCalc) 一个中文友好的实时计算笔记本
   - [AiEnglish](https://tsfullstack.heartstack.space/AiEnglish) 在阅读中渐进式学习英语

其他应用示范

- 浏览器扩展 - InfoFlow
  - 基于 https://wxt.dev/guide/installation.html 构建，用于演示如何使用 tsfullstack 作为浏览器扩展的后端支持。

## 快速开始

1. clone 项目
2. 安装依赖：进入 backend 目录，执行 `pnpm i` 安装依赖 (忽略错误： Failed to resolve entry for package "tsfullstack-backend" ,我们将在之后的步骤中生成这个包)
3. 初始化数据库：在 backend 目录下执行 `pnpm zenstack generate` 和 `pnpm prisma migrate dev`
4. 编译 tsfullstack-backend api 包:在 backend 目录下执行 `pnpm build:lib` （会报一些类型错误，我暂时没找到好的解决方案，但不影响使用，不用管）
5. 启动后端服务：在 backend 目录下执行 `pnpm dev`
6. 启动前端服务：在 website-frontend 目录下执行 `pnpm dev`
