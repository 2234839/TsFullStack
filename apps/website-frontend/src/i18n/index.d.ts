/**
 * vue-i18n 类型声明
 *
 * 为 i18n 添加类型支持
 */
import type { ComposerTranslation } from 'vue-i18n';

/** 从 i18n/zh-CN.json 和 i18n/en.json 中提取所有翻译键的类型 */
export type I18nMessageKey =
  | 'autoTable.affectedRows'
  | '文件管理'
  | '文件名'
  | '类型'
  | '大小'
  | '上传时间'
  | '操作'
  | '预览'
  | '下载'
  | '该文件类型不支持预览'
  | '您可以下载文件以查看内容'
  | '关闭'
  | '登录'
  | '退出登录'
  | '切换主题'
  | '切换语言'
  | 'AI配置'
  | string; // 允许任意字符串作为后备

/** 扩展 vue-i18n 的 ComposerTranslation 类型 */
declare module 'vue-i18n' {
  export interface DefineLocaleMessage {
    // 这里可以定义更详细的消息类型结构
    [key: string]: any;
  }

  /** 扩展 $t 函数的类型 */
  export interface ComposerTranslation {
    <Key extends I18nMessageKey>(key: Key): string;
    <Key extends I18nMessageKey, Args extends Record<string, any>>(key: Key, args: Args): string;
  }
}

/** 扩展全局组件属性以包含 $t */
declare module '@vue/runtime-core' {
  export interface ComponentCustomProperties {
    /**
     * i18n 翻译函数
     */
    $t: <Key extends I18nMessageKey>(key: Key) => string;
  }
}

export {};
