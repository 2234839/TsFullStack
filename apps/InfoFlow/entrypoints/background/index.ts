import { browser, defineBackground } from '#imports';
import { registerDbService } from './service/dbService';
import { registerConfigsService } from './service/configService';
import { registerRulesService } from './service/rulesService';
import { registerTaskExecutionService } from './service/taskExecutionService';
import { registerCronService, getCronService } from './service/cronService';
import { getTaskExecutionService } from './service/taskExecutionService';

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
});

// 更新未读数量角标
async function updateUnreadBadge() {
  try {
    const taskExecutionService = getTaskExecutionService();
    const unreadCount = await taskExecutionService.getTotalUnreadCount();

    if (unreadCount > 0) {
      // 设置badge文字
      browser.action.setBadgeText({ text: unreadCount.toString() });
      // 设置badge背景色为红色（更醒目）
      browser.action.setBadgeBackgroundColor({ color: '#ef442299' });
      // 设置badge标题
      browser.action.setTitle({ title: `InfoFlow - ${unreadCount} 条未读记录` });
    } else {
      // 没有未读记录时清除badge
      browser.action.setBadgeText({ text: '' });
      browser.action.setTitle({ title: 'InfoFlow - 网页信息订阅' });
    }
  } catch (error) {
    console.error('Failed to update unread badge:', error);
  }
}
