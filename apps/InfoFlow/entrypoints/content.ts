import { browser, defineContentScript } from '#imports';
import type { RuleConfig } from '@/storage/config';

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    console.log('Hello content.');
  },
});
browser.runtime.onMessage.addListener(async (request, sender) => {
  if (request.type !== 'EXECUTE_ACTION') return;
  const rule = request.data as RuleConfig;
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, 3000);
  });
  console.log('[rule]', rule);
  const els = Object.values(rule.target.selector).map((selector) => {
    return [...document.querySelectorAll(selector)].map((el) => el.textContent);
  });
  console.log('[els]', els);
  browser.runtime.sendMessage({
    type: 'ACTION_COMPLETED',
    data: {
      /* 结果数据 */
    },
  });
  console.log('[request]', request);
});
