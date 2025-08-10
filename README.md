# TsFullStack

[English Document](./README.md) [中文文档](./README_zh.md)

---

This is my TypeScript full-stack best practice project. After defining data models, you can directly operate the database from the frontend without writing backend API code, enabling rapid MVP development.

> I'm really tired of writing traditional admin pages and don't want to do it anymore.

[Live Demo](http://tsfullstack.heartstack.space/)

https://deepwiki.com/2234839/TsFullStack

[Documentation](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## Features

- Backend
  - Tech stack: ts + prisma + zenstack + Effect + fastify
  - Zenstack (an enhanced solution based on prisma) for database modeling and Row Level Security.

- Bridge
  - Tech stack: ts + superjson + self-developed RPC library
  - Frontend can directly call backend APIs with full TypeScript type hints, eliminating the need for middleware code.
  - Superjson supports complex object serialization/deserialization (Date, Map, Set, RegExp, etc.), ensuring seamless transfer of prisma parameters and results.

- Frontend
  - Tech stack: ts + vue3 + tailwindcss + primevue component library
  - Perfect i18n internationalization support with dynamic language switching without page reload.
  - Light/dark theme switching with synchronized component and tailwindcss support.
  - Implemented feature pages:
    - Prisma Studio-like admin panel (serving as an open-source alternative to some extent), eliminating repetitive CRUD page development.
    - [NoteCalc](https://tsfullstack.heartstack.space/noteCalc) - A Chinese-friendly real-time calculation notebook
    - [AiEnglish](https://tsfullstack.heartstack.space/AiEnglish) - Progressive English learning while reading

Other application examples

- Browser Extension - InfoFlow
  - Built with https://wxt.dev/guide/installation.html to demonstrate using tsfullstack as backend support for browser extensions.

- API Proxy
  - Cloudflare Workers-based API proxy service for solving GitHub/npm access issues in restricted network environments.
  - Supports both direct proxy and universal proxy modes.
  - See `apps/api-proxy/` for details.

## Quick Start

1. Clone the project
2. Install dependencies: Enter backend directory and run `pnpm i` (ignore errors: Failed to resolve entry for package "tsfullstack-backend", we'll generate this package in later steps)
3. Initialize database: In backend directory, run `pnpm zenstack generate` and `pnpm prisma migrate dev`
4. Build tsfullstack-backend api package: In backend directory run `pnpm build:lib` (some TypeScript errors may appear but won't affect usage)
5. Start backend service: In backend directory run `pnpm dev`
6. Start frontend service: In website-frontend directory run `pnpm dev`