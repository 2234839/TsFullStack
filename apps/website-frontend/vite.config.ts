import { defineConfig, lazyPlugins } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import vueDevTools from "vite-plugin-vue-devtools";
import vueJsx from "@vitejs/plugin-vue-jsx";
import Components from "unplugin-vue-components/vite";
import { vitePluginAutoRoutes } from "./src/plugins/vite-plugin-auto-routes";
import { pilot } from "vite-plugin-pilot";

// https://vite.dev/config/
export default defineConfig({
  plugins: lazyPlugins(() => [
    Components({
      dts: true,
      dirs: ["src/components", "src/pages/**/components"],
    }),
    vitePluginAutoRoutes(),
    pilot({ locale: "zh" }),
    vue(),
    vueJsx(),
    tailwindcss(),
    vueDevTools(),
  ]),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["aframe"],
  },
  build: {
    sourcemap: true,
  },
});
