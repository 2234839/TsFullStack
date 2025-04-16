import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN.json';
import en from './en.json';
console.log('[en]',en);
export const i18n = createI18n({
  locale: 'zhCN',
  legacy: false,
  messages: {
    en: en,
    zhCN: zhCN,
  },
});
export const t = i18n.global.t