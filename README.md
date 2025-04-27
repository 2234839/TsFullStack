# TsFullStack  

[English Document](./README.md) [中文文档](./README_zh.md)  

---  

This is my TypeScript full-stack best practices project.  

> I'm truly fed up with traditional admin interfaces. I never want to write them again.  

[Live Demo](http://tsfullstack.heartstack.space/)  

https://deepwiki.com/2234839/TsFullStack  

[Documentation](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)  

## Features  

- **Backend**  
  - Tech Stack: ts + prisma + zenstack + Effect + fastify  
  - Uses zenstack (a Prisma-based enhancement solution) for database modeling and Row Level Security.  

- **Bridge Layer**  
  - Tech Stack: ts + superjson + custom RPC library  
  - Frontend can directly call backend APIs with full TypeScript type hints, eliminating the need for middleware code.  
  - superjson supports serialization/deserialization of complex objects (Date, Map, Set, RegExp, etc.), ensuring seamless data transfer for Prisma inputs and outputs.  

- **Admin Interface**  
  - Tech Stack: ts + vue3 + tailwindcss + PrimeVue component library  
  - Features a Prisma Studio-like admin panel (partially serving as an open-source alternative), eliminating repetitive CRUD page development.  
  - Comprehensive i18n internationalization support, enabling dynamic language switching without page reloads.  
  - Light/dark theme toggling with synchronized component and Tailwind CSS support.  

Other Application Examples  

- **Browser Extension - InfoFlow**  
  - Built using https://wxt.dev/guide/installation.html, demonstrating how to leverage TsFullStack for browser extension development.