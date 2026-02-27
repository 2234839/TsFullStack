/// <reference types="vite/client" />
/// <reference path="./global-vue.d.ts" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
