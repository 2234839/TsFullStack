/**
 * 支付相关工具函数
 *
 * 提取自多个页面的重复逻辑：状态标签、渠道名称等
 */

/** 订单状态 → 标签颜色 */
export function getStatusVariant(status: string): 'warn' | 'success' | 'danger' | 'info' | 'secondary' {
  const map: Record<string, 'warn' | 'success' | 'danger' | 'info' | 'secondary'> = {
    PENDING: 'warn',
    PAID: 'success',
    CANCELLED: 'danger',
    FAILED: 'danger',
    REFUNDED: 'secondary',
  };
  return map[status] ?? 'info';
}

/** 订单状态 → 显示文本 */
export function getStatusLabel(status: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    PENDING: t('待支付'),
    PAID: t('已支付'),
    FAILED: t('支付失败'),
    CANCELLED: t('已取消'),
    REFUNDED: t('已退款'),
  };
  return map[status] ?? status;
}

/** 支付渠道 → 显示名称 */
export function getProviderName(provider: string | null, t: (key: string) => string): string {
  if (!provider) return '--';
  const map: Record<string, string> = {
    MBD: t('面包多'),
    AFDIAN: t('爱发电'),
    WECHAT: t('微信好友'),
  };
  return map[provider] ?? provider;
}

/** 套餐类型 → 显示文本 */
export function getPackageTypeLabel(type: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    MONTHLY: t('月度订阅'),
    YEARLY: t('年度订阅'),
    PERMANENT: t('永久'),
    ONCE: t('一次性'),
  };
  return map[type] ?? type;
}

/** 套餐类型 → 标签颜色 */
export function getPackageTypeVariant(type: string): 'secondary' | 'success' | 'warn' | 'danger' | 'info' {
  const map: Record<string, 'secondary' | 'success' | 'warn' | 'danger' | 'info'> = {
    MONTHLY: 'info',
    YEARLY: 'secondary',
    PERMANENT: 'success',
    ONCE: 'warn',
  };
  return map[type] ?? 'info';
}

/** 支付渠道 → 图标 */
export function getProviderIcon(provider: string): string {
  const map: Record<string, string> = {
    MBD: 'pi pi-wallet',
    AFDIAN: 'pi pi-heart',
    WECHAT: 'pi pi-comments',
  };
  return map[provider] ?? 'pi pi-credit-card';
}
