/**
 * i18n 组合式函数
 *
 * 统一的翻译函数，避免全局类型声明问题
 */
import { useI18n as useVueI18n } from 'vue-i18n';

/** 导出翻译函数 */
export function useI18n() {
  const { t } = useVueI18n();
  return { t };
}
