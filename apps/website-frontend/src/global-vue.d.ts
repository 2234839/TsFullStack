/**
 * PrimeVue Tooltip 指令类型声明
 *
 * 注意：不要在这里 declare module 'vue'，因为这会覆盖 vue-i18n 和 vue-router 的类型扩展。
 * 只需要声明全局指令即可。
 */
declare module '@vue/runtime-core' {
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
