import { browser, createApp, createShadowRootUi, defineContentScript } from '#imports';
import '~/src/styles/app.css';
import 'primeicons/primeicons.css';
import 'primevue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import App from './content/contentApp.vue';
import { ConfirmationService, ToastService } from 'primevue';
import { runTaskMessageId, type runInfoFlowGet_task, type TaskResult } from '@/services/InfoFlowGet/messageProtocol';

// =============================================================================
// Configuration Constants
// =============================================================================

const DEFAULT_TIMEOUT = 30000;
const POLL_INTERVAL = 500;
const ELEMENT_WAIT_TIMEOUT = 10000;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Wait for an element to appear in the DOM
 */
async function waitForElement(selector: string, timeout: number = ELEMENT_WAIT_TIMEOUT): Promise<Element> {
  const element = document.querySelector(selector);
  if (element) {
    return element;
  }

  return new Promise((resolve, reject) => {
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
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Create a delay promise
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe JavaScript code execution
 */
function createSafeAsyncFunction(code: string): () => Promise<any> {
  return new Function(`
    return async function() {
      ${code}
    }
  `)();
}

// =============================================================================
// Data Collection Functions
// =============================================================================

/**
 * Collect data using CSS selector with retry mechanism
 */
async function collectCSSData(
  method: any,
  maxWaitTime: number,
  pollInterval: number,
  startTime: number
): Promise<{ data: any[]; attempts: number; success: boolean }> {
  let data: any[] = [];
  let attempts = 0;

  while (attempts === 0 || (data.length === 0 && (Date.now() - startTime) < maxWaitTime)) {
    attempts++;

    const elements = document.querySelectorAll(method.selector);
    data = Array.from(elements).map(el => {
      if (method.attribute) {
        return el.getAttribute(method.attribute);
      }
      return el.textContent?.trim() || el.outerHTML;
    }).filter(item => item !== null && item !== undefined && item !== '');

    if (data.length > 0) {
      return { data, attempts, success: true };
    }

    // Wait before retrying
    if ((Date.now() - startTime) < maxWaitTime) {
      await delay(pollInterval);
    }
  }

  return { data: [], attempts, success: false };
}

/**
 * Collect data using JavaScript execution with retry mechanism
 */
async function collectJSData(
  method: any,
  maxWaitTime: number,
  pollInterval: number,
  startTime: number
): Promise<{ data: any; attempts: number; success: boolean }> {
  let attempts = 0;

  while (attempts === 0 || (Date.now() - startTime) < maxWaitTime) {
    attempts++;

    try {
      const asyncFunction = createSafeAsyncFunction(method.code);
      const jsResult = await asyncFunction();

      // Check if result is valid
      if (jsResult !== undefined && jsResult !== null && jsResult !== '') {
        const isValid = Array.isArray(jsResult) ? jsResult.length > 0 : true;
        if (isValid) {
          return { data: jsResult, attempts, success: true };
        }
      }
    } catch (jsError) {
      console.warn(`[JS Execution] Attempt ${attempts} failed:`, jsError);
    }

    // Wait before retrying
    if ((Date.now() - startTime) < maxWaitTime) {
      await delay(pollInterval);
    }
  }

  return { data: null, attempts, success: false };
}

// =============================================================================
// Task Execution Functions
// =============================================================================

/**
 * Execute timing configuration (delay or waitForElement)
 */
async function executeTiming(timing: any): Promise<void> {
  if (!timing) return;

  if (timing.type === 'delay') {
    await delay(timing.ms);
  } else if (timing.type === 'waitForElement') {
    await waitForElement(timing.selector);
    if (timing.delay) {
      await delay(timing.delay);
    }
  }
}

/**
 * Execute a single data collection method
 */
async function executeCollectionMethod(
  method: any,
  collectionKey: string,
  maxWaitTime: number,
  pollInterval: number,
  startTime: number
): Promise<any[]> {
  try {
    console.log(`[Collection] Executing ${method.type} method:`, method);

    if (method.type === 'css') {
      const result = await collectCSSData(method, maxWaitTime, pollInterval, startTime);

      if (result.success) {
        console.log(`[Collection] CSS collected ${result.data.length} items after ${result.attempts} attempts`);
        return result.data;
      } else {
        console.warn(`[Collection] CSS no data found after ${result.attempts} attempts`);
        return [];
      }
    } else if (method.type === 'js') {
      const result = await collectJSData(method, maxWaitTime, pollInterval, startTime);

      if (result.success) {
        console.log(`[Collection] JS completed with result after ${result.attempts} attempts`);
        return Array.isArray(result.data) ? result.data : [result.data];
      } else {
        console.warn(`[Collection] JS no valid result after ${result.attempts} attempts`);
        return [];
      }
    } else {
      console.warn(`[Collection] Unknown method type: ${method.type}`);
      return [];
    }
  } catch (error) {
    console.error(`[Collection] Error in ${method.type} method:`, error);
    return [{ error: error instanceof Error ? error.message : String(error) }];
  }
}

/**
 * Execute the main task with data collection
 */
async function execTask(task: runInfoFlowGet_task): Promise<TaskResult> {
  console.log(`[Task] Starting execution for URL: ${task.url}`);

  // URL validation
  const currentUrl = window.location.href;
  if (task.url && !currentUrl.includes(task.url)) {
    console.warn(`[Task] URL mismatch - Current: ${currentUrl}, Target: ${task.url}`);
    return {
      url: currentUrl,
      title: document.title,
      timestamp: new Date().toISOString(),
      matched: 0,
      message: 'URL mismatch'
    };
  }

  // Basic result setup
  const result: TaskResult = {
    url: currentUrl,
    title: document.title,
    timestamp: new Date().toISOString(),
    matched: 1,
    collections: {}
  };

  // Early return if no data collection configured
  if (!task.dataCollection || task.dataCollection.length === 0) {
    console.log(`[Task] No data collection configured, returning basic info`);
    return result;
  }

  // Execute data collection with retry mechanism
  const maxWaitTime = task.timeout || DEFAULT_TIMEOUT;
  const startTime = Date.now();

  console.log(`[Task] Starting data collection with ${task.dataCollection.length} methods`);

  for (let i = 0; i < task.dataCollection.length; i++) {
    const method = task.dataCollection[i];
    const collectionKey = `collection_${i}`;

    result.collections![collectionKey] = await executeCollectionMethod(
      method,
      collectionKey,
      maxWaitTime,
      POLL_INTERVAL,
      startTime
    );
  }

  console.log(`[Task] Completed with ${Object.keys(result.collections!).length} collections`);
  return result;
}

/**
 * Execute task with timeout protection
 */
async function executeWithTiming(task: runInfoFlowGet_task): Promise<TaskResult> {
  const timeout = task.timeout || DEFAULT_TIMEOUT;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Task execution timeout')), timeout);
  });

  const executionPromise = async (): Promise<TaskResult> => {
    await executeTiming(task.timing);
    return await execTask(task);
  };

  return Promise.race([executionPromise(), timeoutPromise]);
}

// =============================================================================
// UI Setup Functions
// =============================================================================

/**
 * Create and configure Vue application
 */
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

/**
 * Setup shadow root UI
 */
async function setupUI(ctx: any) {
  const ui = await createShadowRootUi(ctx, {
    name: 'infoflow-ui',
    position: 'inline',
    anchor: 'body',
    onMount: createVueApp,
    onRemove: (app) => app?.unmount(),
  });
  ui.mount();
}

// =============================================================================
// Message Handler
// =============================================================================

/**
 * Setup message listener for task execution
 */
function setupMessageListener() {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Message] Received:', message);

    if (message.action === runTaskMessageId) {
      const task = message.data as runInfoFlowGet_task;
      console.log('[Message] Executing task:', task);

      executeWithTiming(task)
        .then((result) => {
          console.log('[Message] Task completed successfully:', result);
          sendResponse(result);
        })
        .catch((error) => {
          console.error('[Message] Task execution failed:', error);
          sendResponse({ error: error.message });
        });

      return true; // Keep message channel open for async response
    }
  });
}

// =============================================================================
// Main Content Script
// =============================================================================

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('[ContentScript] Initializing InfoFlow content script');
    setupMessageListener();
    await setupUI(ctx);
    console.log('[ContentScript] InfoFlow content script initialized');
  },
});