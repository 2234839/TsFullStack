/**
 * 全局类型声明
 *
 * 用于扩展组件实例的全局属性类型
 */
import type { RouteLocationNormalized } from 'vue-router';

/** i18n 翻译键类型 */
export type I18nMessageKey = string;

declare module '@vue/runtime-core' {
  export interface ComponentCustomProperties {
    /**
     * vue-router 路由对象
     */
    $route: RouteLocationNormalized;

    /**
     * vue-router 路由实例
     */
    $router: import('vue-router').Router;
  }
}

/** 扩展 vue-i18n 的类型 */
declare module 'vue-i18n' {
  export interface DefineLocaleMessage {
    [key: string]: any;
  }

  export interface ComposerTranslation {
    <Key extends I18nMessageKey>(key: Key): string;
    <Key extends I18nMessageKey, Args extends Record<string, any>>(key: Key, args: Args): string;
  }
}

export {};
