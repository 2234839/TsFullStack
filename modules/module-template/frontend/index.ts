// ABOUTME: Vue库模板入口文件，导出所有公共组件和工具函数
export { default as HelloWorld } from '@/components/HelloWorld.vue'
export type { HelloWorldProps } from '@/components/types'

// 版本信息
export const version = '0.1.0'

// 安装函数
import type { App } from 'vue'
import HelloWorld from '@/components/HelloWorld.vue'

export default {
  install(app: App) {
    app.component('HelloWorld', HelloWorld)
  }
}

// 导出样式
import '@/style.css'