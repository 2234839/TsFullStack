# TsFullStack

[English Document](./README.md) | [中文文档](./README_zh.md)

---

This is my TypeScript full-stack best practices project. It enables frontend to directly interact with the database without writing backend API code after defining data models, accelerating MVP development.

> I'm completely fed up with traditional admin pages and never want to write them again.

[Live Demo](http://tsfullstack.heartstack.space/)

https://deepwiki.com/2234839/TsFullStack

[Documentation](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## Features

### Backend
- **Tech Stack**: TypeScript + Prisma + ZenStack + Effect + Fastify
- Uses ZenStack (Prisma-based enhancement solution) for data modeling and Row Level Security

### Bridge Layer
- **Tech Stack**: TypeScript + SuperJSON + Custom RPC Library
- Frontend directly calls backend APIs with full TypeScript type hints, eliminating middleware code
- SuperJSON supports complex object serialization/deserialization (Date, Map, Set, RegExp, etc.), ensuring seamless Prisma parameter/result transfers

### Frontend
- **Tech Stack**: TypeScript + Vue 3 + Tailwind CSS + PrimeVue Component Library
- Comprehensive i18n internationalization support with dynamic language switching (no page reload)
- Light/dark theme switching with synchronized component and TailwindCSS support
- Implemented feature pages:
  - Prisma Studio-like admin panel (viable open-source alternative) - eliminates repetitive CRUD pages
  - [NoteCalc](https://tsfullstack.heartstack.space/noteCalc) - Chinese-friendly real-time calculation notebook
  - [AiEnglish](https://tsfullstack.heartstack.space/AiEnglish) - Progressive English learning through reading

### Other Implementations
- Browser Extension - InfoFlow
  - Built with [wxt.dev](https://wxt.dev/guide/installation.html)
  - Demonstrates using TsFullStack as backend support for browser extensions