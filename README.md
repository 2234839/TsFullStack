# TsFullStack

[English](./README.md) | [中文](./README_zh.md) | [日本語](./README_ja.md) | [한국어](./README_ko.md) | [Français](./README_fr.md) | [Deutsch](./README_de.md) | [Español](./README_es.md)

---

This is my TypeScript full-stack best practices project. It allows frontend direct database operations without writing backend API code after defining data models, enabling rapid MVP development.

> I'm really tired of traditional admin panel pages, I never want to write them again.

[Live Demo](http://tsfullstack.heartstack.space/)

[Project Online AI Documentation](https://zread.ai/2234839/TsFullStack)

[Documentation](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## Features

- Backend
  - Tech stack: TypeScript + Prisma + ZenStack + Effect + Fastify
  - ZenStack (enhanced solution based on Prisma) for database modeling and Row Level Security.

- Bridge
  - Tech stack: TypeScript + SuperJSON + custom RPC library
  - Frontend directly calls backend APIs with complete TypeScript type hints, no middleware code needed.
  - SuperJSON supports complex object serialization and deserialization, such as Date, Map, Set, RegExp..., ensuring Prisma input parameters and return results can be seamlessly transferred.

- Frontend
  - Tech stack: TypeScript + Vue 3 + Tailwind CSS + PrimeVue component library
  - Perfect i18n internationalization support, ensuring every detail supports dynamic language switching without page reload.
  - Light/dark theme switching, components and Tailwind CSS support dynamic switching simultaneously.
  - Some implemented feature pages
   - Prisma Studio-like admin panel (can serve as an open-source alternative to some extent), no need to write repetitive CRUD pages.
   - [NoteCalc](https://tsfullstack.heartstack.space/noteCalc) A Chinese-friendly real-time calculation notebook
   - [AiEnglish](https://tsfullstack.heartstack.space/AiEnglish) Progressive English learning through reading

Other Application Demos

- Browser Extension - InfoFlow
  - Built on https://wxt.dev/guide/installation.html to demonstrate using tsfullstack as backend support for browser extensions.

## Quick Start

1. Clone the project
2. Install dependencies: Go to the backend directory and run `pnpm i` to install dependencies (ignore error: Failed to resolve entry for package "@tsfullstack/backend", we will generate this package in later steps)
3. Initialize database: In the backend directory, run `pnpm zenstack generate` and `pnpm prisma migrate dev`
4. Build @tsfullstack/backend API package: In the backend directory, run `pnpm build:lib` (there will be some type errors, I haven't found a good solution yet, but it doesn't affect usage, don't worry about it)
5. Start backend service: In the backend directory, run `pnpm dev`
6. Start frontend service: In the website-frontend directory, run `pnpm dev`

## Project Structure Design

> [Design Philosophy](https://shenzilong.cn/index/如何实现模块化加载的前端和后端代码.html)

- Project Base
  - apps/website-frontend is the frontend base project
  - apps/backend is the backend base project
- Modular frontend and backend project code
  - modules/*
  - Frontend code within modules can directly reference backend code interfaces within the module
