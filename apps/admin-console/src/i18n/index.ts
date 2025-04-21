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

async function loadLocaleMessages(locale: string) {
  if (modules['./' + locale + '.json'] === undefined) {
    return false;
  }
  console.log(`matched locale: ${locale}`);
  const messages = (await modules['./' + locale + '.json']()) as { default: any };
  i18n.global.setLocaleMessage(locale, messages.default);
  return true;
}

export async function initI18n() {
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
initI18n();
