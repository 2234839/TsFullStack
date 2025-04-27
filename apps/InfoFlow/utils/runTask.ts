import { browser } from '#imports';
import type { RuleConfig } from '@/storage/config';

export async function runTask(rule: RuleConfig) {
  try {
    // 在后台打开新tab页
    const tab = await browser.tabs.create({
      url: rule.target.url,
      active: false,
    });

    // 等待页面加载完成
    await new Promise<void>((resolve) => {
      browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          browser.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });

    await browser.tabs.sendMessage(tab.id!, {
      type: 'EXECUTE_ACTION',
      data: rule, // 可以传递任何需要的数据
    });

    return
    // 关闭tab页
    await browser.tabs.remove(tab.id);

    // 执行AI处理
    if (rule.action.aiPrompt && contents.length > 0) {
      const response = await fetch('https://api.example.com/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: rule.action.aiPrompt,
          context: contents.join('\n'),
        }),
      });
      const result = await response.json();

      // 发送通知
      if (rule.action.notification.enabled) {
        const message =
          rule.action.notification.format ?
            rule.action.notification.format.replace('{result}', result)
          : result;

        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('icon/48.png'),
          title: rule.name,
          message,
        });
      }

      return result;
    }
  } catch (error) {
    console.error('执行任务失败:', error);
    throw error;
  }
}
