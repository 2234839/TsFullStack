<template>
  <div class="pricing-page p-6 max-w-6xl mx-auto">
    <!-- 页面标题 -->
    <div class="mb-8 text-center">
      <h1 class="text-3xl font-bold text-primary-900 dark:text-primary-50 mb-2">{{ t('选择套餐') }}</h1>
      <p class="text-gray-500 dark:text-gray-400">{{ t('选择适合您的代币套餐，立即开始使用') }}</p>
    </div>

    <!-- 支付状态轮询指示器 -->
    <div
      v-if="isPolling"
      class="mb-6 p-4 rounded-lg bg-info-50 dark:bg-info-950 border border-info-200 dark:border-info-800"
    >
      <div class="flex items-center gap-3">
        <ProgressSpinner style="width: 24px; height: 24px" />
        <div>
          <p class="text-sm font-medium text-info-800 dark:text-info-200">
            {{ t('等待支付完成...') }}
          </p>
          <p class="text-xs text-info-600 dark:text-info-400 mt-0.5">
            {{ t('请在支付页面完成付款，系统将自动确认支付结果') }}
          </p>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && !isPolling" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <!-- 套餐卡片列表 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <Card
        v-for="pkg in packages"
        :key="pkg.id"
        :class="[
          'cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1',
          !pkg.active && 'opacity-60',
          selectedPackage?.id === pkg.id && 'ring-2 ring-primary-500',
        ]"
        @click="selectPackage(pkg)"
      >
        <div class="p-6">
          <!-- 套餐名称和类型标签 -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-semibold text-primary-900 dark:text-primary-50">{{ pkg.name }}</h3>
            <Tag :value="getTypeLabel(pkg.type)" :variant="getTypeVariant(pkg.type)" />
          </div>

          <!-- 描述 -->
          <p v-if="pkg.description" class="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
            {{ pkg.description }}
          </p>

          <!-- 价格 -->
          <div class="mb-4">
            <span class="text-3xl font-bold text-primary-600 dark:text-info-400">
              {{ formatPrice(pkg.price) }}
            </span>
            <span class="text-sm text-gray-500 dark:text-gray-400 ml-1">{{ t('元') }}</span>
          </div>

          <!-- 代币数量 -->
          <div class="flex items-baseline gap-2 mb-4">
            <span class="text-lg font-medium text-secondary-700 dark:text-secondary-300">
              {{ pkg.amount }} {{ t('代币') }}
            </span>
            <span v-if="pkg.durationMonths > 0" class="text-sm text-gray-500 dark:text-gray-400">
              / {{ pkg.durationMonths }}{{ t('个月') }}
            </span>
          </div>

          <!-- 购买按钮 -->
          <Button
            :label="pkg.active ? t('立即购买') : t('已停用')"
            :icon="'pi pi-shopping-cart'"
            :disabled="!pkg.active || pkg.price === null || pkg.price <= 0"
            :variant="selectedPackage?.id === pkg.id ? 'primary' : 'secondary'"
            class="w-full"
            @click.stop="openPayDialog(pkg)"
          />
        </div>
      </Card>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && packages.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <i class="pi pi-inbox text-4xl mb-4 block"></i>
      <p>{{ t('暂无可用套餐') }}</p>
    </div>

    <!-- 支付方式选择弹窗 -->
    <Dialog v-model:open="payDialogOpen" :title="t('选择支付方式')">
      <div class="space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('套餐') }}: {{ selectedPackage?.name }} - {{ formatPrice(selectedPackage?.price) }}{{ t('元') }}
        </p>

        <div v-for="provider in availableProviders" :key="provider.provider" class="space-y-2">
          <Button
            :label="provider.enabled ? provider.name : `${provider.name}(${t('即将上线')})`"
            :icon="getProviderIcon(provider.provider)"
            :disabled="!provider.enabled || creatingOrder"
            :loading="creatingOrder && creatingProvider === provider.provider"
            variant="secondary"
            class="w-full h-14 text-left justify-start gap-3"
            @click="handleCreateOrder(provider.provider as PaymentProvider)"
          />
        </div>

        <div v-if="availableProviders.length === 0" class="text-center py-4 text-gray-500 dark:text-gray-400">
          {{ t('暂无可用的支付渠道') }}
        </div>
      </div>
    </Dialog>

    <!-- 微信支付引导面板 -->
    <WechatPayGuide
      v-if="wechatGuideOpen"
      :orderInfo="wechatOrderInfo!"
      @close="wechatGuideOpen = false"
    />

    <!-- 联系微信指引（支付问题兜底） -->
    <div
      v-if="contactInfo.wechatAccountId"
      class="mt-6 p-3 rounded-lg bg-info-50 dark:bg-info-950 border border-info-200 dark:border-info-800 flex items-center gap-3 text-sm"
    >
      <i class="pi pi-info-circle text-info-500 flex-shrink-0" />
      <span class="text-info-700 dark:text-info-300">
        {{ t('遇到支付问题？添加微信') }}
        <button
          class="font-mono font-medium text-info-800 dark:text-info-200 underline hover:no-underline mx-1"
          @click="copyContactId"
        >{{ contactInfo.wechatAccountId }}</button>
        {{ t('联系站长') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAPI } from '@/api';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { Card, Button, Tag, ProgressSpinner } from '@/components/base';
import { Dialog } from '@tsfullstack/shared-frontend/components';
import { useDocumentVisibility, useIntervalFn, tryOnUnmounted } from '@vueuse/core';
import WechatPayGuide from './WechatPayGuide.vue';
import type { PaymentProvider, OrderStatus } from '@tsfullstack/backend';

const toast = useToast();
const { t } = useI18n();
const { API } = useAPI();

/** 套餐数据类型（与后端 TokenPackage 模型对应） */
interface TokenPackage {
  id: number;
  name: string;
  type: string;
  description: string | null;
  amount: number;
  price: number | null;
  durationMonths: number;
  active: boolean;
}

/** 套餐列表 */
const packages = ref<TokenPackage[]>([]);
/** 加载状态 */
const loading = ref(true);
/** 选中的套餐 */
const selectedPackage = ref<TokenPackage | null>(null);
/** 支付弹窗是否打开 */
const payDialogOpen = ref(false);
/** 可用的支付渠道 */
const availableProviders = ref<{ provider: string; name: string; enabled: boolean }[]>([]);
/** 正在创建订单 */
const creatingOrder = ref(false);
/** 当前正在创建的支付渠道 */
const creatingProvider = ref<string>('');

/** 微信引导面板是否打开 */
const wechatGuideOpen = ref(false);
/** 当前微信订单信息 */
const wechatOrderInfo = ref<{
  orderId: number;
  orderNo: string;
  amount: number;
  packageName: string;
  wechatAccountId: string;
  wechatAccountName: string;
} | null>(null);
/** 联系方式信息（从后端配置读取） */
const contactInfo = ref<{ wechatAccountId: string | null; wechatAccountName: string | null }>({
  wechatAccountId: null,
  wechatAccountName: null,
});

/** ========== 支付结果轮询相关 ========== */

/** 当前正在轮询的订单ID */
const pollingOrderId = ref<number | null>(null);
/** 轮询中的订单状态 */
const pollingOrderStatus = ref<OrderStatus | null>(null);
/** 是否正在轮询中 */
const isPolling = ref(false);
/** 最大轮询次数 (5秒 * 60 = 5分钟超时) */
const MAX_POLL_COUNT = 60;
/** 当前轮询次数 */
let pollCount = 0;
/** 轮询控制器 */
let pollControls: { pause: () => void; resume: () => void } | null = null;

/**
 * 轮询订单状态
 *
 * 参考 UseApiStorage.ts 模式:
 * - useIntervalFn 定期查询
 * - useDocumentVisibility 页面不可见时暂停
 * - tryOnUnmounted 卸载时清理
 */
async function pollOrderStatus() {
  if (!pollingOrderId.value) return;

  try {
    const order = await API.paymentApi.queryOrder(pollingOrderId.value) as Order | null;

    if (!order) {
      stopPolling();
      return;
    }

    pollingOrderStatus.value = order.status as OrderStatus;
    pollCount++;

    if (order.status === 'PAID') {
      stopPolling();
      toast.success(t('支付成功！代币已发放到您的账户'));
    } else if (order.status === 'CANCELLED') {
      stopPolling();
      toast.warn(t('订单已取消'));
    } else if (order.status === 'FAILED') {
      stopPolling();
      toast.error(t('支付失败，请重试'));
    } else if (new Date(order.expireAt) < new Date()) {
      stopPolling();
      toast.warn(t('订单已过期'));
    } else if (pollCount >= MAX_POLL_COUNT) {
      stopPolling();
      toast.info(t('支付结果确认中，请稍后在"我的订单"页面查看'));
    }
  } catch (e) {
    console.error('[PricingPage] 轮询订单状态失败:', e);
  }
}

/** 启动轮询（预留：非微信渠道支付后可启用） */
function _startPolling(orderId: number) {
  stopPolling();

  pollingOrderId.value = orderId;
  pollingOrderStatus.value = null;
  isPolling.value = true;
  pollCount = 0;

  const { pause, resume } = useIntervalFn(pollOrderStatus, 5000);

  const visibility = useDocumentVisibility();
  watch(visibility, (vis) => {
    if (vis === 'visible') {
      resume();
      pollOrderStatus();
    } else if (vis === 'hidden') {
      pause();
    }
  });

  pollControls = { pause, resume };

  tryOnUnmounted(() => {
    stopPolling();
  });
}

/** 停止轮询 */
function stopPolling() {
  if (pollControls) {
    pollControls.pause();
    pollControls = null;
  }
  isPolling.value = false;
  pollingOrderId.value = null;
}

/** ========== 套餐/购买相关 ========== */

/** 获取类型标签文本 */
function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    MONTHLY: t('月度订阅'),
    YEARLY: t('年度订阅'),
    PERMANENT: t('永久'),
    ONCE: t('一次性'),
  };
  return map[type] ?? type;
}

/** 获取类型标签颜色变体 */
function getTypeVariant(type: string): 'secondary' | 'success' | 'warn' | 'danger' | 'info' {
  const map: Record<string, 'secondary' | 'success' | 'warn' | 'danger' | 'info'> = {
    MONTHLY: 'info',
    YEARLY: 'secondary',
    PERMANENT: 'success',
    ONCE: 'warn',
  };
  return map[type] ?? 'info';
}

/** 格式化价格（分→元） */
function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return '--';
  return (price / 100).toFixed(2);
}

/** 获取支付渠道图标 */
function getProviderIcon(provider: string): string {
  const map: Record<string, string> = {
    MBD: 'pi pi-wallet',
    AFDIAN: 'pi pi-heart',
    WECHAT: 'pi pi-comments',
  };
  return map[provider] ?? 'pi pi-credit-card';
}

/** 选择套餐 */
function selectPackage(pkg: TokenPackage) {
  selectedPackage.value = pkg;
}

/** 打开支付弹窗 */
function openPayDialog(pkg: TokenPackage) {
  if (!pkg.active || pkg.price === null || pkg.price <= 0) return;
  selectedPackage.value = pkg;
  payDialogOpen.value = true;
}

/** 创建订单后跳转订单详情页 */
async function handleCreateOrder(provider: PaymentProvider) {
  if (!selectedPackage.value) return;

  creatingOrder.value = true;
  creatingProvider.value = provider;

  try {
    const result = await API.paymentApi.createOrder({
      packageId: selectedPackage.value.id,
      provider,
    });

    if (result?.payUrl && result?.orderId) {
      // 微信好友支付：保存订单信息后打开引导面板
      if (result.payUrl === 'wechat://manual') {
        payDialogOpen.value = false;
        const pd = result.providerData as Record<string, unknown> | undefined;
        wechatOrderInfo.value = {
          orderId: result.orderId,
          orderNo: result.orderNo,
          amount: selectedPackage.value.price ?? 0,
          packageName: selectedPackage.value.name,
          wechatAccountId: String(pd?.wechatAccountId ?? ''),
          wechatAccountName: String(pd?.wechatAccountName ?? ''),
        };
        wechatGuideOpen.value = true;
      }

      // 所有渠道：关闭弹窗，跳转到订单列表
      payDialogOpen.value = false;
      window.location.href = '/pricing/orderList';
    }
  } catch (e) {
    console.error('[PricingPage] 创建订单失败:', e);
  } finally {
    creatingOrder.value = false;
    creatingProvider.value = '';
  }
}

/** 加载套餐列表 */
async function loadPackages() {
  loading.value = true;
  try {
    const result = await API.db.tokenPackage.findMany({
      where: { active: true },
      orderBy: [{ price: 'asc' }],
    });
    packages.value = (result ?? []) as TokenPackage[];
  } catch (e) {
    console.error('[PricingPage] 加载套餐失败:', e);
  } finally {
    loading.value = false;
  }
}

/** 加载可用支付渠道 */
async function loadProviders() {
  try {
    const result = await API.paymentApi.getAvailableProviders();
    availableProviders.value = result ?? [];
  } catch (e) {
    console.error('[PricingPage] 加载支付渠道失败:', e);
  }
}

/** 加载公开联系方式（微信号等） */
async function loadContactInfo() {
  try {
    const result = await API.paymentApi.getPublicContactInfo();
    contactInfo.value = result ?? { wechatAccountId: null, wechatAccountName: null };
  } catch (e) {
    console.error('[PricingPage] 加载联系方式失败:', e);
  }
}

/** 复制联系方式微信号 */
async function copyContactId() {
  if (!contactInfo.value.wechatAccountId) return;
  try {
    await navigator.clipboard.writeText(contactInfo.value.wechatAccountId);
    toast.success(t('已复制到剪贴板'));
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = contactInfo.value.wechatAccountId;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    toast.success(t('已复制到剪贴板'));
  }
}

onMounted(() => {
  loadPackages();
  loadProviders();
  loadContactInfo();
});
</script>
