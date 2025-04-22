import { i18nStore } from '@/storage';
import { usePreferredLanguages } from '@vueuse/core';
import { createI18n } from 'vue-i18n';

const modules = import.meta.glob('./*.json');

export const i18n = createI18n({
  locale: 'zh-CN',
  legacy: false,
  missingWarn: false,
});

export const t = i18n.global.t;

const languages = usePreferredLanguages();

export async function loadLocaleMessages(locale: string) {
  if (modules['./' + locale + '.json'] === undefined) {
    return false;
  }
  const messages = (await modules['./' + locale + '.json']()) as { default: any };
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
