# TsFullStack

[English Document](./README.md) [中文文档](./README_zh.md)

---

This is my best practice project for ts full-stack.

> I'm really fed up with traditional management end pages, I no longer want to write them.

[Online Experience](http://tsfullstack.heartstack.space/)

https://deepwiki.com/2234839/TsFullStack

[Document Address](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## Features

- Backend
  - Technology Stack: ts + prisma + zenstack + Effect + fastify
  - zenstack (an enhanced solution based on prisma) for database modeling and Row Level Security.

- Bridge
  - Technology Stack: ts + superjson + self-developed RPC library
  - The frontend can directly call the backend API with complete ts type hints, without the need to write intermediate layer code.
  - superjson supports complex object serialization and deserialization, such as Date, Map, Set, RegExp..., ensuring that prisma's input parameters and return results can be seamlessly passed.

- Management End
  - Technology Stack: ts + vue3 + tailwindcss + primevue component library
  - A management panel similar to prisma studio (to some extent, it can be used as an open-source alternative), no longer needing to write the same old CRUD pages.
  - Perfect i18n internationalization support, ensuring that every detail supports multi-language dynamic switching without reloading the page.
  - Light/dark theme switching, components and tailwindcss support dynamic switching synchronously.