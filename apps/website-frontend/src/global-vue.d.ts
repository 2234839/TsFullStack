/**
 * 全局类型声明
 *
 * 用于暂时搁置一些全局属性的类型错误
 */
import type { RouteLocationNormalized } from 'vue-router';

declare module '@vue/runtime-core' {
  export interface ComponentCustomProperties {
    /**
     * vue-router 路由对象
     * @todo 需要正确配置 vue-router 的类型扩展
     */
    $route: RouteLocationNormalized;

    /**
     * vue-router 路由实例
     * @todo 需要正确配置 vue-router 的类型扩展
     */
    $router: import('vue-router').Router;
  }
}

export {};
