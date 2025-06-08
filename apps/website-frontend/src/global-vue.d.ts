declare module 'vue' {
  export interface ComponentCustomOptions {}
  export interface ComponentCustomProperties {}
  export interface GlobalComponents {}
  export interface GlobalDirectives {
    /** Tooltip directive for PrimeVue components.
     *
     * 支持 `v-tooltip.[right|left|top|bottom]` 的用法。
     */
    vTooltip: (msg: string) => void;
  }
}
/** 这是必须的，以确保 TypeScript 能够识别自定义指令。 */
export {};
