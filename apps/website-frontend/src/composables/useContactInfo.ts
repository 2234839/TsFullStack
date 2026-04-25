import { shallowRef } from 'vue';
import { useAPI } from '@/api';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { copyToClipboard } from '@/utils/clipboard';

/**
 * 联系方式信息 composable
 *
 * 从后端获取公开的联系方式（如微信号），
 * 提供加载、复制等操作，供支付页面和订单列表共用。
 */
export function useContactInfo() {
  const toast = useToast();
  const { t } = useI18n();
  const { API } = useAPI();

  const contactInfo = shallowRef<{ wechatAccountId: string | null; wechatAccountName: string | null }>({
    wechatAccountId: null,
    wechatAccountName: null,
  });

  async function loadContactInfo() {
    try {
      const result = await API.paymentApi.getPublicContactInfo();
      contactInfo.value = result ?? { wechatAccountId: null, wechatAccountName: null };
    } catch (_e: unknown) {
      console.warn('[useContactInfo] 加载联系方式失败');
    }
  }

  async function copyContactId() {
    if (!contactInfo.value.wechatAccountId) return;
    try {
      await copyToClipboard(contactInfo.value.wechatAccountId);
      toast.success(t('已复制到剪贴板'));
    } catch {
      toast.error(t('复制失败'));
    }
  }

  return { contactInfo, loadContactInfo, copyContactId };
}
