# TsFullStack  

[English Document](./README.md) [中文文档](./README_zh.md)  

---  

This is my TypeScript full-stack best practices project.  

> I'm utterly fed up with traditional admin interface pages and never want to write them again.  

[Live Demo](http://tsfullstack.heartstack.space/)  

https://deepwiki.com/2234839/TsFullStack  

[Documentation](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)  

## Features  

- **Backend**  
  - Tech Stack: ts + prisma + zenstack + Effect + fastify  
  - Uses zenstack (a prisma-based enhancement solution) for database modeling and Row Level Security.  

- **Bridge Layer**  
  - Tech Stack: ts + superjson + custom RPC library  
  - Frontend can directly call backend APIs with full TypeScript type hints, eliminating the need for intermediate layer code.  
  - superjson supports serialization/deserialization of complex objects (Date, Map, Set, RegExp, etc.), ensuring seamless transfer of Prisma inputs and outputs.  

- **Admin Interface**  
  - Tech Stack: ts + vue3 + tailwindcss + PrimeVue component library  
  - Features a Prisma Studio-like admin panel (serving as a viable open-source alternative to some extent), eliminating repetitive CRUD page development.  
  - Comprehensive i18n internationalization support with dynamic language switching without page reloads.  
  - Light/dark theme toggle with synchronized component and TailwindCSS support.  

### Other Application Demonstrations  

- **Browser Extension - InfoFlow**  
  - Built on https://wxt.dev/guide/installation.html to demonstrate using TsFullStack as backend support for browser extensions.