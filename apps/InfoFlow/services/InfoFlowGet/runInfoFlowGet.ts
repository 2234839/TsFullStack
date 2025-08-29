import { browser } from '#imports';
import { runTaskMessageId, type runInfoFlowGet_task, type TaskResult } from './messageProtocol';

/**
 * 只能在后台运行
 */
export async function runInfoFlowGet(task: runInfoFlowGet_task) {
  console.log('[run task]',task);
  // 在后台打开新标签页
  const tab = await browser.tabs.create({
    url: task.url,
    /** 配置为 pinned 可以让标签页固定在左侧，而且占据的tab宽度很小 */
    pinned: true,
    /** 设置为 false 不会切换到新标签页，不影响用户当前操作 */
    active: false,
  });
  const openedTabId = tab.id;
  if (!openedTabId) {
    throw '获取打开的标签页id失败';
  }

  // 等待标签页加载完毕
  await new Promise((r) => {
    // 监听标签页更新事件，等待页面加载完成
    const handleTabUpdate = (tabId: number, changeInfo: any) => {
      if (tabId === openedTabId && changeInfo.status === 'complete') {
        browser.tabs.onUpdated.removeListener(handleTabUpdate);
        r(1);
      }
    };
    browser.tabs.onUpdated.addListener(handleTabUpdate);
  });

  // 页面加载完成，等待一下让 content script 初始化
  try {
    const res = await browser.tabs.sendMessage(openedTabId, {
      action: runTaskMessageId,
      data: task,
    });
    console.log('收到 content script 的响应:', res);
    return res as TaskResult;
  } catch (error) {
    console.log('发送消息失败:', error);
    return {
      url: task.url,
      title: '',
      timestamp: new Date().toISOString(),
      matched: 0,
      message: 'Failed to execute task',
      links: [],
      images: [],
      forms: [],
      metadata: { description: '', keywords: '', author: '' },
      stats: { totalElements: 0, textNodes: 0, loadTime: 0 }
    } as TaskResult;
  } finally {
    browser.tabs.remove(openedTabId);
  }
}
