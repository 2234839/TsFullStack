# TsFullStack

[中文文档](./README-zh.md)

---

This is my TypeScript full-stack best practices project.

> I'm done with traditional admin pages. I never want to write them again.

[Live Demo](http://tsfullstack.heartstack.space/)

[Documentation](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## Features

- Backend

  - Tech Stack: TypeScript + Prisma + ZenStack + Effect + Fastify
  - ZenStack (Prisma enhancement) for database modeling and Row Level Security.

- Bridge Layer

  - Tech Stack: TypeScript + Superjson + Custom RPC Library
  - Frontend can directly call backend APIs with full TypeScript type hints, eliminating middleware code.
  - Superjson supports complex object serialization (Date, Map, Set, RegExp, etc.), ensuring seamless Prisma parameter/result transfer.

- Admin Interface
  - Tech Stack: TypeScript + Vue3 + TailwindCSS + PrimeVue Component Library
  - Prisma Studio-like admin panel (partially open-source alternative), eliminating repetitive CRUD pages.
  - i18n internationalization support for multiple languages.
