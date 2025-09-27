# TsFullStack

[English Document](./README.md) [中文文档](./README_zh.md) [Documentación en Español](./README_es.md) [日本語ドキュメント](./README_ja.md) [한국어 문서](./README_ko.md) [Documentation française](./README_fr.md) [Deutsche Dokumentation](./README_de.md)

---

Este es mi proyecto de mejores prácticas para full-stack con TypeScript. Permite operar directamente la base de datos desde el frontend sin escribir código de API del backend después de definir los modelos de datos, para desarrollar rápidamente modelos MVP.

> Estoy realmente harto de las páginas tradicionales de administración, nunca más quiero escribir una.

[Experiencia en línea](http://tsfullstack.heartstack.space/)

[![zread](https://img.shields.io/badge/Ask_Zread-_.svg)](https://zread.ai/2234839/TsFullStack) [Documentación IA del proyecto en línea](https://zread.ai/2234839/TsFullStack)

[Dirección de la documentación](https://shenzilong.cn/index/TsFullStack.html#20250413211142-d533spm)

## Características

- Backend
  - Stack tecnológico: ts + prisma + zenstack + Effect + fastify
  - zenstack (solución mejorada basada en prisma) para implementar modelado de base de datos y Row Level Security.

- Puente
  - Stack tecnológico: ts + superjson + biblioteca RPC autodesarrollada
  - El frontend llama directamente a las APIs del backend con sugerencias de tipo ts completas, sin necesidad de escribir código de capa intermedia.
  - superjson soporta serialización y deserialización de objetos complejos como Date, Map, Set, RegExp..., asegurando que los parámetros de entrada y resultados de prisma puedan transmitirse sin problemas.

- Frontend
  - Stack tecnológico: ts + vue3 + tailwindcss + biblioteca de componentes primevue
  - Soporte de internacionalización i18n perfecto, asegurando que cada detalle soporte cambio dinámico de idioma sin necesidad de recargar la página.
  - Cambio de tema claro/oscuro, componentes y tailwindcss soportan cambio dinámico sincronizado.
  - Algunas páginas de funcionalidad implementadas
   - Panel de administración tipo prisma studio (puede servir como alternativa de código abierto hasta cierto punto), ya no es necesario escribir páginas CRUD monótonas.
   - [NoteCalc](https://tsfullstack.heartstack.space/noteCalc) Un bloc de notas de cálculo en tiempo real amigable con el chino
   - [AiEnglish](https://tsfullstack.heartstack.space/AiEnglish) Aprendizaje progresivo de inglés durante la lectura

Otros ejemplos de aplicaciones

- Extensión de navegador - InfoFlow
  - Construida basada en https://wxt.dev/guide/installation.html, para demostrar cómo usar tsfullstack como soporte backend para extensiones de navegador.

## Inicio rápido

1. Clonar el proyecto
2. Instalar dependencias: entrar al directorio backend, ejecutar `pnpm i` para instalar dependencias (ignorar errores: Failed to resolve entry for package "@tsfullstack/backend", generaremos este paquete en pasos posteriores)
3. Inicializar base de datos: en el directorio backend ejecutar `pnpm zenstack generate` y `pnpm prisma migrate dev`
4. Compilar el paquete API @tsfullstack/backend: en el directorio backend ejecutar `pnpm build:lib` (habrá algunos errores de tipos, aún no he encontrado una buena solución, pero no afecta el uso, ignorar)
5. Iniciar servicio backend: en el directorio backend ejecutar `pnpm dev`
6. Iniciar servicio frontend: en el directorio website-frontend ejecutar `pnpm dev`

## Diseño de la estructura del proyecto

> [Filosofía de diseño](https://shenzilong.cn/index/如何实现模块化加载的前端和后端代码.html)

- Base del proyecto
  - apps/website-frontend es el proyecto base del frontend
  - apps/backend es el proyecto base del backend
- Código de proyecto frontend y backend modularizado
  - modules/*
  - El código frontend dentro de los módulos puede referenciar directamente las interfaces del código backend dentro del mismo módulo