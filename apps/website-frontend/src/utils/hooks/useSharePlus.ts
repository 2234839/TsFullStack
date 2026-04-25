import { useShare } from '@vueuse/core';
import { useToast } from '@/composables/useToast';
import { t } from '@/i18n';
import { copyToClipboard } from '@/utils/clipboard';

/** 增强分享功能，默认使用浏览器原生分享功能，会降级为使用复制到剪贴板功能 */
export function useSharePlus() {
  const { share: shareRaw, isSupported } = useShare();
  const toast = useToast();
  const share = async ({
    title,
    text,
    url,
    copyTitleAndText = false,
  }: {
    title: string;
    text: string;
    url: string;
    copyTitleAndText?: boolean;
  }) => {
    if (isSupported.value) {
      await shareRaw({ title, text, url });
    } else {
      const contentToCopy = copyTitleAndText ? `${title}\n${text}\n${url}` : url;
      await copyToClipboard(contentToCopy);
      toast.success(t('已复制到剪贴板'));
    }
  };

  return { share };
}
