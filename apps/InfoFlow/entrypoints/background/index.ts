import { browser, defineBackground } from '#imports';
import { registerDbService } from './service/dbService';
import { registerConfigsService } from './service/configService';
import { registerRulesService } from './service/rulesService';
import { registerTaskExecutionService } from './service/taskExecutionService';
import { registerCronService, getCronService } from './service/cronService';
import { getTaskExecutionService } from './service/taskExecutionService';
import { contentScriptReadyMessageId } from '@/services/InfoFlowGet/messageProtocol';

// 内容脚本加载状态管理
const contentScriptReadyMap = new Map<number, { url: string; timestamp: number }>();

/** 等待指定tab的内容脚本加载完成 */
export async function waitForContentScriptReady(tabId: number): Promise<boolean> {
  // 检查是否已经准备好
  if (contentScriptReadyMap.has(tabId)) {
    return true;
  }

  // 等待内容脚本通知
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (contentScriptReadyMap.has(tabId)) {
        clearInterval(checkInterval);
        resolve(true);
      }
    }, 100);
  });
}

export default defineBackground(() => {
  registerDbService();
  registerConfigsService();
  registerRulesService();
  registerTaskExecutionService();
  registerCronService();

  // Start all active rules when background script starts
  getCronService().startAllActiveRules().catch(console.error);
  if (import.meta.env.DEV) {
    browser.runtime.openOptionsPage();
  }

  // 点击扩展图标直接打开options页面
  browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage();
  });

  // 初始化时更新badge
  updateUnreadBadge();

  // 定期更新badge（每30秒）
  setInterval(updateUnreadBadge, 3000);

  // 监听规则执行完成事件，更新badge
  browser.runtime.onMessage.addListener((message: any) => {
    if (message.type === 'RULE_EXECUTION_COMPLETED') {
      updateUnreadBadge();
    }
  });

  // 监听内容脚本加载完成通知
  browser.runtime.onMessage.addListener((message: any, sender: any) => {
    if (message.action === contentScriptReadyMessageId) {
      const { url, timestamp } = message.data;
      const tabId = sender.tab?.id;

      console.log(`Content script ready for tab ${tabId}: ${url}`);

      // 记录内容脚本加载状态
      if (tabId) {
        contentScriptReadyMap.set(tabId, { url, timestamp });

        // 5分钟后清理过期记录
        setTimeout(() => {
          contentScriptReadyMap.delete(tabId);
        }, 5 * 60 * 1000);
      }
    }
  });

  // 监听标签页关闭，清理对应的内容脚本记录
  browser.tabs.onRemoved.addListener((tabId: number) => {
    contentScriptReadyMap.delete(tabId);
  });
});

// 更新未读数量角标
async function updateUnreadBadge() {
  try {
    const taskExecutionService = getTaskExecutionService();
    const unreadCount = await taskExecutionService.getTotalUnreadCount();

    if (unreadCount > 0) {
      // 设置badge文字
      browser.action.setBadgeText({ text: unreadCount.toString() });
      // 设置badge文字颜色为白色
      browser.action.setBadgeTextColor({ color: '#ffffff' });
      // 根据环境设置不同的badge背景色
      const isDev = import.meta.env.DEV;
      browser.action.setBadgeBackgroundColor({
        color: isDev ? '#3b82f6' : '#ef4422',
      });
      // 设置badge标题
      browser.action.setTitle({
        title: `InfoFlow ${isDev ? '[Dev]' : ''} - ${unreadCount} 条未读记录`,
      });
    } else {
      // 没有未读记录时清除badge
      browser.action.setBadgeText({ text: '' });
      browser.action.setTitle({ title: 'InfoFlow - 网页信息订阅' });
    }
  } catch (error) {
    console.error('Failed to update unread badge:', error);
  }
}
