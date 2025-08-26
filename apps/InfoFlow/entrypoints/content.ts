import { browser, createApp, createShadowRootUi, defineContentScript } from '#imports';
import '~/assets/tailwindcss.css';
import 'primeicons/primeicons.css';
import 'primevue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import App from './content/contentApp.vue';
import { ConfirmationService, ToastService } from 'primevue';
import { runTaskMessageId, type runInfoFlowGet_task, type TaskResult } from '@/services/InfoFlowGet/messageProtocol';

function setupMessageListener() {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[message]',message);
    if (message.action === runTaskMessageId) {
      const task = message.data as runInfoFlowGet_task;
      console.log('[task]', task);
      executeWithTiming(task).then((res) => {
        sendResponse(res);
      }).catch((error) => {
        console.error('[task execution error]', error);
        sendResponse({ error: error.message });
      });
      return true;
    }
  });
}

function createVueApp(container: Element) {
  const app = createApp(App);
  app.use(PrimeVue, {
    theme: {
      preset: Aura,
    },
  });
  app.use(ToastService);
  app.use(ConfirmationService);
  app.mount(container);
  return app;
}

async function setupUI(ctx: any) {
  // https://github.com/primefaces/primeuix/pull/47 不支持primevue组件样式的原因
  const ui = await createShadowRootUi(ctx, {
    name: 'infoflow-ui',
    position: 'inline',
    anchor: 'body',
    onMount: createVueApp,
    onRemove: (app) => app?.unmount(),
  });
  ui.mount();
}

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    setupMessageListener();
    await setupUI(ctx);
  },
});

async function waitForElement(selector: string, timeout: number = 10000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element "${selector}" not found within ${timeout}ms`));
    }, timeout);
  });
}

async function executeWithTiming(task: runInfoFlowGet_task) {
  const timeout = task.timeout || 30000;

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Task execution timeout')), timeout);
  });

  const executionPromise = async () => {
    if (task.timing) {
      if (task.timing.type === 'delay') {
        const timing = task.timing as Extract<typeof task.timing, { type: 'delay' }>;
        await new Promise(resolve => setTimeout(resolve, timing.ms));
      } else if (task.timing.type === 'waitForElement') {
        const timing = task.timing as Extract<typeof task.timing, { type: 'waitForElement' }>;
        await waitForElement(timing.selector);
        if (timing.delay) {
          await new Promise(resolve => setTimeout(resolve, timing.delay));
        }
      }
    }

    return await execTask(task);
  };

  return Promise.race([executionPromise(), timeoutPromise]);
}

async function execTask(task: runInfoFlowGet_task) {
  console.log(`[execTask] Starting task for URL: ${task.url}`);

  // 检查当前URL是否匹配任务URL
  const currentUrl = window.location.href;
  if (task.url && !currentUrl.includes(task.url)) {
    console.warn(`[execTask] Current URL ${currentUrl} does not match target URL ${task.url}`);
    return {
      url: currentUrl,
      title: document.title,
      timestamp: new Date().toISOString(),
      matched: false,
      message: 'URL mismatch'
    };
  }

  const result: TaskResult = {
    url: currentUrl,
    title: document.title,
    timestamp: new Date().toISOString(),
    matched: true,
    collections: {}
  };

  // 如果没有配置数据收集，返回基本信息
  if (!task.dataCollection || task.dataCollection.length === 0) {
    console.log(`[execTask] No data collection configured, returning basic info`);
    return result;
  }

  // 执行数据收集
  for (let i = 0; i < task.dataCollection.length; i++) {
    const method = task.dataCollection[i];
    const collectionKey = `collection_${i}`;

    try {
      console.log(`[execTask] Executing collection method ${i}:`, method);

      if (method.type === 'css') {
        // CSS 选择器收集
        const elements = document.querySelectorAll(method.selector);
        const data = Array.from(elements).map(el => {
          if (method.attribute) {
            return el.getAttribute(method.attribute);
          }
          return el.textContent?.trim() || el.outerHTML;
        }).filter(item => item !== null && item !== undefined);

        result.collections![collectionKey] = data;
        console.log(`[execTask] CSS collection ${i} collected ${data.length} items`);

      } else if (method.type === 'js') {
        // JavaScript 代码执行
        const asyncFunction = new Function(`
          return async function() {
            ${method.code}
          }
        `)();

        const jsResult = await asyncFunction();
        result.collections![collectionKey] = Array.isArray(jsResult) ? jsResult : [jsResult];
        console.log(`[execTask] JS collection ${i} completed`);
      }

    } catch (error) {
      console.error(`[execTask] Error in collection method ${i}:`, error);
      result.collections![collectionKey] = [{ error: error instanceof Error ? error.message : String(error) }];
    }
  }

  console.log(`[execTask] Task completed with ${Object.keys(result.collections!).length} collections`);
  return result;
}
