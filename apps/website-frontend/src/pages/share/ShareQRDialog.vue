<template>
  <Dialog v-model:open="visible" :title="t('分享二维码')">
    <div class="text-center">
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-primary-900 dark:text-white mb-2">
          {{ title }}
        </h3>
        <p class="text-sm text-primary-theme">
          {{ t('扫描二维码访问分享') }}
        </p>
      </div>

      <div class="flex justify-center mb-4">
        <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" :alt="t('分享二维码')"
          class="border border-primary-300 dark:border-primary-600 rounded-lg" width="200" height="200" />
        <div v-else class="w-52 h-52 flex items-center justify-center text-primary-subtle">
          {{ t('生成二维码中...') }}
        </div>
      </div>

      <div class="text-xs text-primary-subtle break-all">
        {{ shareUrl }}
      </div>

      <div class="mt-4">
        <Button :label="t('复制链接')" icon="pi pi-copy" size="sm" @click="handleCopyLink" />
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
  import { Dialog } from '@tsfullstack/shared-frontend/components';
  import { computed, ref, watch } from 'vue';
  import { useI18n } from '@/composables/useI18n';
  import { useToast } from '@/composables/useToast';
  import { copyToClipboard } from '@/utils/clipboard';
  import QRCode from 'qrcode';

  const { t } = useI18n();
  const toast = useToast();

  const { open, shareUrl, title } = defineProps<{
    open: boolean;
    /** 分享链接 */
    shareUrl: string;
    /** 分享标题 */
    title: string;
  }>();

  const emit = defineEmits<{
    'update:open': [value: boolean];
  }>();

  const visible = computed({
    get: () => open,
    set: (val: boolean) => emit('update:open', val),
  });

  const qrCodeDataUrl = ref('');

  watch(
    () => open,
    async (isVisible) => {
      if (!isVisible || !shareUrl) return;
      try {
        qrCodeDataUrl.value = await QRCode.toDataURL(shareUrl, {
          width: 200,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
        });
      } catch {
        toast.error(t('生成二维码失败'));
        qrCodeDataUrl.value = '';
      }
    },
  );

  async function handleCopyLink() {
    try {
      await copyToClipboard(shareUrl);
      toast.success(t('链接已复制到剪贴板'));
    } catch {
      toast.error(t('复制失败'));
    }
  }
</script>
