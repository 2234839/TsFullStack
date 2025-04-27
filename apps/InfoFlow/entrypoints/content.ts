import { browser, createApp, createShadowRootUi, defineContentScript } from '#imports';
import type { RuleConfig } from '@/storage/config';
import App from './content/app.vue';
import { calculateHash } from '@/utils/hash';
import { API } from '@/utils/api';
import { authStore } from '@/storage/auth';
export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'example-ui',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const app = createApp(App);
        app.mount(container);
        return app;
      },
      onRemove: (app) => {
        app?.unmount();
      },
    });
    console.log('[ui]', ui);
    ui.mount();
  },
});
browser.runtime.onMessage.addListener(async (request, sender) => {
  if (request.type !== 'EXECUTE_ACTION') return;
  const rule = request.data as RuleConfig;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 6000);
  });
  console.log('[rule]', rule);
  const els = Object.values(rule.target.selector).map((selector) => {
    return [...document.querySelectorAll(selector)].map(async (el) => {
      const html = el.innerHTML;
      const hash = await calculateHash(html);
      return { html, hash };
    });
  });
  const res = await Promise.all(els.flat()); // 等待所有异步操作完成
  console.log('[res] ', res);
  const hasInDB = await API.db.userData.findMany({
    where: {
      appId: 'InfoFlow-info',
      key: {
        in: res.map((item) => item.hash),
      },
    },
  });
  const newInfo = res.filter((item) => !hasInDB.some((dbItem) => dbItem.key === item.hash));
  console.log('[newInfo]', newInfo);
  const dataToStore = newInfo.map((el) => {
    return {
      appId: 'InfoFlow-info',
      userId: authStore.value.userId!,
      key: el.hash,
      data: el.html,
    };
  });
  // 将新信息存储到数据库中
  API.db.userData.createMany({
    data: dataToStore,
  });

  browser.runtime.sendMessage({
    type: 'ACTION_COMPLETED',
    data: {
      /* 结果数据 */
    },
  });
  console.log('[request]', request);
});
