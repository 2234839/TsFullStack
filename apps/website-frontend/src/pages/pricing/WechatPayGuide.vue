<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
      <!-- 头部 -->
      <div class="bg-green-500 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <i class="pi pi-wechat text-white text-2xl" />
          <h2 class="text-lg font-semibold text-white">{{ t('微信好友支付') }}</h2>
        </div>
        <button
          class="text-white/80 hover:text-white transition-colors p-1 rounded"
          :aria-label="t('关闭')"
          @click="emit('close')"
        >
          <i class="pi pi-times text-lg" />
        </button>
      </div>

      <!-- 内容区 -->
      <div class="p-6 space-y-5">
        <!-- 提示说明 -->
        <div class="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p class="text-sm text-green-800 dark:text-green-200 leading-relaxed">
            {{ t('请通过微信向站长转账') }} <span class="font-bold text-danger-600">{{ formatPrice(props.orderInfo.amount) }}{{ t('元') }}</span>
            {{ t('，转账后发送订单信息给站长确认，确认到账后会自动发放代币') }}
          </p>
        </div>

        <!-- 站长微信号 -->
        <div class="text-center space-y-2">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('站长微信号') }}</p>
          <div class="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
            <span class="text-lg font-mono font-bold text-primary-600 dark:text-primary-400">
              {{ props.orderInfo.wechatAccountId }}
            </span>
            <Button
              :label="copiedId ? t('已复制!') : t('复制')"
              :icon="copiedId ? 'pi pi-check' : 'pi pi-copy'"
              :variant="'secondary'"
              size="small"
              @click="copyId"
            />
          </div>
          <p v-if="props.orderInfo.wechatAccountName" class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('昵称') }}: {{ props.orderInfo.wechatAccountName }}
          </p>
        </div>

        <!-- 订单信息卡片 -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2 bg-gray-50 dark:bg-gray-800/50">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500 dark:text-gray-400">{{ t('订单号') }}</span>
            <span class="font-mono font-medium">{{ props.orderInfo.orderNo }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-500 dark:text-gray-400">{{ t('套餐') }}</span>
            <span class="font-medium">{{ props.orderInfo.packageName }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-500 dark:text-gray-400">{{ t('金额') }}</span>
            <span class="font-bold text-danger-500">{{ formatPrice(props.orderInfo.amount) }}{{ t('元') }}</span>
          </div>
        </div>

        <!-- 一键复制按钮 -->
        <Button
          :label="copiedMsg ? t('已复制!') : t('复制订单信息')"
          :icon="copiedMsg ? 'pi pi-check' : 'pi pi-copy'"
          :variant="'primary'"
          class="w-full h-12"
          @click="copyOrderInfo"
        />

        <!-- 格式化文本预览（默认展开） -->
        <details open class="group">
          <summary class="cursor-pointer text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 select-none">
            {{ t('查看发送给站长的消息格式') }} ▼
          </summary>
          <pre class="mt-2 bg-gray-100 dark:bg-gray-800 rounded p-3 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all">{{ formattedMessage }}</pre>
        </details>

        <!-- 底部提示 -->
        <p class="text-center text-xs text-gray-400 dark:text-gray-500">
          <i class="pi pi-info-circle mr-1" />
          {{ t('站长确认后自动发放代币，无需其他操作') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { Button } from '@/components/base';

const toast = useToast();
const { t } = useI18n();

/** 组件属性 */
const props = defineProps<{
  orderInfo: {
    orderId: number;
    orderNo: string;
    amount: number;
    packageName: string;
    wechatAccountId: string;
    wechatAccountName: string;
  };
}>();

/** 事件 */
const emit = defineEmits<{ close: [] }>();

/** 是否已复制微信号 */
const copiedId = ref(false);
/** 是否已复制订单信息 */
const copiedMsg = ref(false);

/** 格式化价格（分→元） */
function formatPrice(price: number): string {
  if (price === null || price === undefined) return '--';
  return (price / 100).toFixed(2);
}

/** 生成要复制的格式化消息文本 */
const formattedMessage = computed(() => {
  return [
    `[TsFullStack 代币购买]`,
    `${t('订单号')}: ${props.orderInfo.orderNo}`,
    `${t('套餐')}: ${props.orderInfo.packageName}`,
    `${t('金额')}: ${formatPrice(props.orderInfo.amount)}${t('元')}`,
  ].join('\n');
});

/** 复制文本到剪贴板 */
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/** 复制微信号 */
async function copyId() {
  await copyToClipboard(props.orderInfo.wechatAccountId);
  copiedId.value = true;
  toast.success(t('已复制到剪贴板'));
  setTimeout(() => { copiedId.value = false; }, 2000);
}

/** 一键复制订单信息 */
async function copyOrderInfo() {
  await copyToClipboard(formattedMessage.value);
  copiedMsg.value = true;
  toast.success(t('已复制到剪贴板'));
  setTimeout(() => { copiedMsg.value = false; }, 2000);
}
</script>
