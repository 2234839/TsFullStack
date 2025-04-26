# TsFullStack  

[English Document](./README.md) [中文文档](./README_zh.md)  

---  

This is my TypeScript full-stack best practices project.  

> I'm truly fed up with traditional admin pages—I never want to write them again.  

[Live Demo](http://tsfullstack.heartstack.space/)  

https://deepwiki.com/2234839/TsFullStack  

[Documentation](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)  

## Features  

- **Backend**  
  - Tech Stack: TypeScript + Prisma + ZenStack + Effect + Fastify  
  - ZenStack (an enhanced solution based on Prisma) for database modeling and Row Level Security.  

- **Bridge Layer**  
  - Tech Stack: TypeScript + SuperJSON + Custom RPC Library  
  - Frontend can directly call backend APIs with full TypeScript type hints, eliminating the need for intermediate layer code.  
  - SuperJSON supports serialization and deserialization of complex objects (e.g., Date, Map, Set, RegExp...), ensuring seamless transfer of Prisma inputs and outputs.  

- **Admin Interface**  
  - Tech Stack: TypeScript + Vue 3 + TailwindCSS + PrimeVue Component Library  
  - Features a Prisma Studio-like admin panel (to some extent serving as an open-source alternative), eliminating the need for repetitive CRUD pages.  
  - Comprehensive i18n internationalization support, ensuring every detail supports dynamic multi-language switching without page reloads.  
  - Light/dark theme switching, with components and TailwindCSS dynamically adapting in sync.