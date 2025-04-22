# TsFullStack

这是我的 ts 全栈最佳实践项目。

> 对于传统管理端页面我真的受够了，我再也不想写了。

[在线体验](http://tsfullstack.heartstack.space/)

[文档地址](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## 特性

- 后端
  - 技术栈：ts + prisma + zenstack + Effect + fastify
  - zenstack（基于 prisma 的增强方案）来实现数据库建模和 Row Level Security 。

- 桥梁
  - 技术栈：ts + superjson + 自研 RPC 库
  - 前端直接调用后端 API 具有完整的 ts 类型提示，无需编写中间层代码。
  - superjson 支持复杂对象序列化和反序列化，如 Date、Map、Set、RegExp...,确保 primsa 的入参和返回结果可以无缝传递。

- 管理端
  - 技术栈：ts + vue3 + tailwindcss + primevue 组件库
  - 具有类 prisma studio 的管理面板（一定程度上可以作为他的开源替代方案），不再需要写千篇一律的 CRUD 页面。
  - i18n 国际化支持，支持多语言。
