// tailwind.config.js
/**
 * ⚠️ 主题颜色已迁移至 src/style.css 的 @theme 块（Tailwind v4 官方机制，OKLCH 色板）。
 * v4 对 JS config 不会生成 CSS 变量，@config 兼容层只生成编译期字面量，
 * 曾导致 var(--color-primary-*) 解析失败、语义化类背景透明的事故。
 * 本文件仅保留 content / darkMode / 插件，勿再往 theme 里加颜色。
 */
import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    "./node_modules/@jctcc/js-util/src/**/*.{vue,js,ts,jsx,tsx}",
    /** 扫描共享组件包的 tailwindcss class，避免这里的样式不生效 */
    "../../packages/shared-frontend/src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  // 手动切换深色模式 https://tailwindcss.com/docs/dark-mode#toggling-dark-mode-manually
  darkMode: "selector",
  plugins: [
    plugin(({ addComponents }) => {
      return addComponents({
        ".no-tailwind-reset": {
          all: "revert",
        },
      });
    }),
  ],
} satisfies Config;
