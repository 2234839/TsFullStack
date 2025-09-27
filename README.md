# TsFullStack

[English Document](./README.md) [中文文档](./README_zh.md) [日本語文書](./README_ja.md) [한국어 문서](./README_ko.md) [Documentation française](./README_fr.md) [Deutsche Dokumentation](./README_de.md) [Documentación en español](./README_es.md)

---

This is my TypeScript full-stack best practice project. It allows direct database operations from the frontend without writing backend API code after defining data models, enabling rapid MVP development.

> I'm really fed up with traditional admin panels, I never want to write them again.

[Live Demo](http://tsfullstack.heartstack.space/)

[![zread](https://img.shields.io/badge/Ask_Zread-_.svg)](https://zread.ai/2234839/TsFullStack) [Project Online AI Documentation](https://zread.ai/2234839/TsFullStack)

[Documentation](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## Features

- Backend
  - Tech stack: TypeScript + Prisma + ZenStack + Effect + Fastify
  - ZenStack (enhanced solution based on Prisma) for database modeling and Row Level Security.

- Bridge
  - Tech stack: TypeScript + SuperJSON + self-developed RPC library
  - Frontend directly calls backend APIs with complete TypeScript type hints, no need to write middleware code.
  - SuperJSON supports complex object serialization and deserialization, such as Date, Map, Set, RegExp..., ensuring Prisma input parameters and return results can be seamlessly passed.

- Frontend
  - Tech stack: TypeScript + Vue 3 + Tailwind CSS + PrimeVue component library
  - Perfect i18n internationalization support, ensuring every detail supports dynamic language switching without page reload.
  - Light/dark theme switching, components and Tailwind CSS support dynamic switching simultaneously.
  - Some implemented feature pages
   - Prisma Studio-like admin panel (to some extent can serve as an open-source alternative), no longer need to write cookie-cutter CRUD pages.
   - [NoteCalc](https://tsfullstack.heartstack.space/noteCalc) A Chinese-friendly real-time calculation notebook
   - [AiEnglish](https://tsfullstack.heartstack.space/AiEnglish) Progressive English learning while reading

Other Application Demos

- Browser Extension - InfoFlow
  - Built based on https://wxt.dev/guide/installation.html to demonstrate how to use tsfullstack as backend support for browser extensions.

## Quick Start

1. Clone the project
2. Install dependencies: Enter the backend directory and run `pnpm i` to install dependencies (ignore error: Failed to resolve entry for package "@tsfullstack/backend", we will generate this package in subsequent steps)
3. Initialize database: In the backend directory, run `pnpm zenstack generate` and `pnpm prisma migrate dev`
4. Compile @tsfullstack/backend API package: In the backend directory, run `pnpm build:lib` (there will be some type errors, I haven't found a good solution yet, but it doesn't affect usage, just ignore it)
5. Start backend service: In the backend directory, run `pnpm dev`
6. Start frontend service: In the website-frontend directory, run `pnpm dev`

## Project Structure Design

> [Design Philosophy](https://shenzilong.cn/index/如何实现模块化加载的前端和后端代码.html)

- Project Base
  - apps/website-frontend is the frontend base project
  - apps/backend is the backend base project
- Modular Frontend and Backend Project Code
  - modules/*
  - Frontend code within modules can directly reference backend code interfaces within the module
