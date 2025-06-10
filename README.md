# TsFullStack

[中文文档](./README_zh.md) [English Document](./README.md)

---

This is my TypeScript full-stack best practice project. After defining data models, you can directly manipulate the database from the frontend without writing backend interface code, enabling rapid MVP development.

> I'm completely fed up with traditional admin pages and never want to write them again.

[Live Demo](http://tsfullstack.heartstack.space/)

https://deepwiki.com/2234839/TsFullStack

[Documentation](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## Features

- Backend
  - Tech Stack: ts + prisma + zenstack + Effect + fastify
  - zenstack (prisma enhancement) for database modeling and Row Level Security.

- Bridge Layer
  - Tech Stack: ts + superjson + custom RPC library
  - Frontend can directly call backend APIs with full TypeScript type hints, no intermediate layer code needed.
  - superjson supports complex object serialization/deserialization (Date, Map, Set, RegExp...), ensuring seamless prisma parameter/return value transfer.

- Frontend
  - Tech Stack: ts + vue3 + tailwindcss + primevue component library
  - Comprehensive i18n internationalization support with dynamic language switching (no page reload).
  - Light/dark theme switching with synchronized component and tailwindcss support.
  - Implemented feature pages:
    - Prisma Studio-like admin panel (can serve as an open-source alternative), eliminating repetitive CRUD pages.
    - [NoteCalc](https://tsfullstack.heartstack.space/noteCalc) - Chinese-friendly real-time calculation notebook
    - [AiEnglish](https://tsfullstack.heartstack.space/AiEnglish) - Progressive English learning through reading

Other Application Examples

- Browser Extension - InfoFlow
  - Built on https://wxt.dev/guide/installation.html, demonstrating how to use TsFullStack as backend support for extensions.

## Quick Start

1. Clone the project
2. Install dependencies: In backend directory, run `pnpm i` (ignore "Failed to resolve entry" error)
3. Initialize database: In backend directory, run `pnpm zenstack generate` then `pnpm prisma migrate dev`
4. Build tsfullstack-backend api package: In backend directory, run `pnpm build:lib` (some type errors may appear but won't affect usage)
5. Start backend: In backend directory, run `pnpm dev`
6. Start frontend: In website-frontend directory, run `pnpm dev`