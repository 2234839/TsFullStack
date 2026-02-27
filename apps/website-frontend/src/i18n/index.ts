import { i18nStore } from '@/storage';
import { usePreferredLanguages } from '@vueuse/core';
import { computed } from 'vue';
import { createI18n, useI18n } from 'vue-i18n';

const modules = import.meta.glob('./*.json');

export const i18n = createI18n({
  locale: 'zh-CN',
  legacy: false,
  missingWarn: false,
  globalInjection: true,
});

export const t = i18n.global.t;

const languages = usePreferredLanguages();

export async function loadLocaleMessages(locale: string) {
  if (modules['./' + locale + '.json'] === undefined) {
    return false;
  }
  const messages = (await (modules['./' + locale + '.json']?.() || Promise.resolve({ default: {} }))) as { default: any };
  console.log(`matched i18n locale: ${locale}`);
  i18n.global.setLocaleMessage(locale, messages.default);
  i18n.global.locale.value = locale;
  return true;
}

export async function initI18n() {
  if (i18nStore.value) {
    await loadLocaleMessages(i18nStore.value);
    return;
  }
  let matched = false;
  for (const locale of languages.value) {
    matched = await loadLocaleMessages(locale);
    if (matched) {
      i18n.global.locale.value = locale;
      break;
    }
  }
  if (!matched) {
    await loadLocaleMessages('en');
  }
}

export function useComputedI18n() {
  const { t } = useI18n();

  const computedI18n = (key: string) => {
    return computed(() => t(key));
  };
  return computedI18n;
}
