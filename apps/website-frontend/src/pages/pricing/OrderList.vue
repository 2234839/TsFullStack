<template>
  <div class="order-list-page p-6 max-w-6xl mx-auto">
    <!-- 页面标题 -->
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-primary-900 dark:text-primary-50">{{ t('我的订单') }}</h1>
      <Button :label="t('去购买')" icon="pi pi-shopping-cart" variant="primary" size="small" @click="goToPricing" />
    </div>

    <!-- 筛选栏 -->
    <Card class="p-4 mb-4">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ t('状态') }}:</label>
          <Select
            v-model="statusFilter"
            :options="statusOptions"
            :placeholder="t('全部')"
            class="w-36"
          />
        </div>
      </div>
    </Card>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <!-- 订单表格 -->
    <Card v-else-if="orders.length > 0" class="overflow-hidden">
      <DataTable :columns="columns" :data="orders" />
    </Card>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="mt-4 flex justify-center">
      <Paginator
        v-model:page="currentPage"
        :total="total"
        :pageSize="pageSize"
        @update:page="loadOrders"
      />
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && orders.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <i class="pi pi-inbox text-4xl mb-4 block"></i>
      <p>{{ t('暂无订单记录') }}</p>
      <Button :label="t('去购买套餐')" icon="pi pi-shopping-cart" variant="secondary" class="mt-4" @click="goToPricing" />
      <!-- 联系微信指引 -->
      <div
        v-if="contactInfo.wechatAccountId"
        class="mt-6 p-3 rounded-lg bg-info-50 dark:bg-info-950 border border-info-200 dark:border-info-800 inline-flex items-center gap-3 text-sm max-w-md mx-auto"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { useAPI } from '@/api';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { routerUtil, routeMap } from '@/router';
import { Card, Button, Tag, ProgressSpinner, DataTable, Paginator } from '@/components/base';
import { Select } from '@tsfullstack/shared-frontend/components';
import type { OrderStatus } from '@tsfullstack/backend';
import { formatDate } from '@/utils/format';

/** DataTable 列定义（与 DataTable.vue 内部接口保持一致） */
interface ColumnDef<T = unknown> {
  key: string;
  title: string;
  sortable?: boolean;
  width?: string | number;
  render?: (row: T, index: number) => import('vue').VNode | string;
}

interface OrderRow {
  id: number;
  orderNo: string;
  package?: { name?: string } | null;
  amount: number;
  provider: string | null;
  status: string;
  paidAt: string | null;
  created: string;
}

const toast = useToast();
const { t } = useI18n();
const { API } = useAPI();

/** 联系方式信息 */
const contactInfo = ref<{ wechatAccountId: string | null; wechatAccountName: string | null }>({
  wechatAccountId: null,
  wechatAccountName: null,
});

/** 订单列表 */
const orders = ref<OrderRow[]>([]);
/** 总数 */
const total = ref(0);
/** 当前页（从0开始） */
const currentPage = ref(0);
/** 每页数量 */
const pageSize = 20;
/** 加载状态 */
const loading = ref(true);
/** 状态筛选 */
const statusFilter = ref<OrderStatus | ''>('');

/** 状态选项 */
const statusOptions = computed(() => [
  { label: t('全部'), value: '' },
  { label: t('待支付'), value: 'PENDING' as OrderStatus },
  { label: t('已支付'), value: 'PAID' as OrderStatus },
  { label: t('已取消'), value: 'CANCELLED' as OrderStatus },
]);

/** 获取状态标签颜色 */
function getStatusVariant(status: string): 'warn' | 'success' | 'danger' | 'info' | 'secondary' {
  const map: Record<string, 'warn' | 'success' | 'danger' | 'info' | 'secondary'> = {
    PENDING: 'warn',
    PAID: 'success',
    CANCELLED: 'danger',
    FAILED: 'danger',
    REFUNDED: 'secondary',
  };
  return map[status] ?? 'info';
}

/** 获取状态文本 */
function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: t('待支付'),
    PAID: t('已支付'),
    FAILED: t('支付失败'),
    CANCELLED: t('已取消'),
    REFUNDED: t('已退款'),
  };
  return map[status] ?? status;
}

/** 获取支付渠道名称 */
function getProviderName(provider: string | null): string {
  if (!provider) return '--';
  const map: Record<string, string> = {
    MBD: t('面包多'),
    AFDIAN: t('爱发电'),
    WECHAT: t('微信好友'),
  };
  return map[provider] ?? provider;
}

/** 表格列定义 */
const columns = computed<ColumnDef<OrderRow>[]>(() => [
  {
    key: 'orderNo',
    title: t('订单号'),
  },
  {
    key: 'package',
    title: t('套餐'),
    render: (row) => h('span', {}, row.package?.name ?? '--'),
  },
  {
    key: 'amount',
    title: t('金额'),
    render: (row) => h('span', {}, `${(row.amount / 100).toFixed(2)}${t('元')}`),
  },
  {
    key: 'provider',
    title: t('渠道'),
    render: (row) => h('span', {}, getProviderName(row.provider)),
  },
  {
    key: 'status',
    title: t('状态'),
    render: (row) => h(Tag, { value: getStatusLabel(row.status), variant: getStatusVariant(row.status) }),
  },
  {
    key: 'created',
    title: t('创建时间'),
    render: (row) => formatDate(new Date(row.created)),
  },
  {
    key: 'actions',
    title: t('操作'),
    render: (row) => {
      if (row.status === 'PENDING') {
        return h('div', { class: 'flex gap-2' }, [
          h(Button, {
            label: t('去支付'),
            size: 'small',
            variant: 'primary',
            onClick: () => handleRepay(row),
          }),
          h(Button, {
            label: t('取消'),
            size: 'small',
            variant: 'ghost',
            onClick: () => handleCancel(row.id),
          }),
        ]);
      }
      return null;
    },
  },
]);

/** 加载订单列表 */
async function loadOrders() {
  loading.value = true;
  try {
    const result = await API.paymentApi.listMyOrders({
      ...(statusFilter.value ? { status: statusFilter.value } : {}),
      skip: currentPage.value * pageSize,
      take: pageSize,
    });
    orders.value = (result?.orders ?? []) as OrderRow[];
    total.value = result?.total ?? 0;
  } catch (e) {
    console.error('[OrderList] 加载订单失败:', e);
  } finally {
    loading.value = false;
  }
}

/** 去支付（重新打开支付链接） */
async function handleRepay(order: OrderRow) {
  toast.info(t('该功能开发中，请联系管理员处理'));
}

/** 取消订单 */
async function handleCancel(orderId: number) {
  try {
    await API.paymentApi.cancelOrder(orderId);
    toast.success(t('订单已取消'));
    await loadOrders();
  } catch (e) {
    console.error('[OrderList] 取消订单失败:', e);
  }
}

/** 跳转到购买页 */
function goToPricing() {
  routerUtil.push(routeMap.pricing, {});
}

/** 加载公开联系方式 */
async function loadContactInfo() {
  try {
    const result = await API.paymentApi.getPublicContactInfo();
    contactInfo.value = result ?? { wechatAccountId: null, wechatAccountName: null };
  } catch (e) {
    console.error('[OrderList] 加载联系方式失败:', e);
  }
}

/** 复制微信号 */
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

watch(statusFilter, () => {
  currentPage.value = 0;
  loadOrders();
});

onMounted(() => {
  loadOrders();
  loadContactInfo();
});
</script>
