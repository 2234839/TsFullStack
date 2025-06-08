// https://router.vuejs.org/zh/guide/advanced/meta

// 这段可以直接添加到你的任何 `.ts` 文件中，例如 `router.ts`
// 也可以添加到一个 `.d.ts` 文件中。确保这个文件包含在
// 项目的 `tsconfig.json` 中的 "file" 字段内。
import 'vue-router';

// 为了确保这个文件被当作一个模块，添加至少一个 `export` 声明
export {};

declare module 'vue-router' {
  interface RouteMeta {
    title: ComputedRef<string>;
  }
}
