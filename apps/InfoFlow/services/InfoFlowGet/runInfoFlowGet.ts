import { browser } from '#imports';
import type { runInfoFlowGet_task } from './messageProtocol';

/**
 * 只能在后台运行
 */
export async function runInfoFlowGet(task: runInfoFlowGet_task) {
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
  browser.tabs
    .sendMessage(openedTabId, {
      action: 'helloFromBackground',
      data: '这是来自后台脚本的消息',
    })
    .then((response) => {
      console.log('收到 content script 的响应:', response);
    })
    .catch((error) => {
      console.log('发送消息失败:', error.message);
    })
    .finally(() => {
      browser.tabs.remove(openedTabId);
    });

  return 1;
}
