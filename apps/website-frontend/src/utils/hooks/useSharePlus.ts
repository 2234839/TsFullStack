import { useClipboard, useShare } from '@vueuse/core';
import { useToast } from 'primevue/usetoast';

/** 增强分享功能，默认使用浏览器原生分享功能，会降级为使用复制到剪贴板功能 */
export function useSharePlus() {
  const { share: shareRaw, isSupported } = useShare();
  const toast = useToast();
  const { copy } = useClipboard();
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
      await copy(contentToCopy);
      toast.add({ severity: 'success', summary: '已复制到剪贴板', life: 3000 });
    }
  };

  return { share };
}
