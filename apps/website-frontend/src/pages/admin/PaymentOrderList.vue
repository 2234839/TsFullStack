<template>
  <div class="payment-order-list-page p-6 max-w-7xl mx-auto">
    <!-- 页面标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-primary-900 dark:text-primary-50 flex items-center gap-2">
        <i class="pi pi-list text-primary-600" />
        {{ t('支付订单') }}
      </h1>
    </div>

    <!-- 筛选栏 -->
    <Card class="p-4 mb-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ t('状态') }}:</label>
          <Select
            v-model="statusFilter"
            :options="statusOptions"
            :placeholder="t('全部')"
            class="w-36"
          />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ t('用户') }}:</label>
          <Input
            v-model="userIdFilter"
            :placeholder="t('输入邮箱搜索')"
            class="w-64"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { useNow } from '@vueuse/core';
import { useAPI } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { Card, ProgressSpinner, DataTable, Paginator, Tag, Input } from '@/components/base';
import { Select } from '@tsfullstack/shared-frontend/components';
import type { ColumnDef } from '@/components/base/DataTable.vue';
import { formatDate } from '@/utils/format';

interface OrderRow {
  orderNo: string;
  user?: { email?: string; nickname?: string } | null;
  package?: { name?: string } | null;
  amount: number;
  provider: string | null;
  status: string;
  paidAt: string | null;
  expireAt: string;
  created: string;
}

const { t } = useI18n();
/** 响应式当前时间（每秒更新） */
const now = useNow({ interval: 1000 });
const { API } = useAPI();

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
/** 状态筛选（空字符串表示"全部"） */
const statusFilter = ref<string>('');
/** 用户邮箱筛选 */
const userIdFilter = ref<string>('');

/** 状态选项 */
const ALL_STATUS = '__ALL__';
const statusOptions = computed(() => [
  { label: t('全部'), value: ALL_STATUS },
  { label: t('待支付'), value: 'PENDING' },
  { label: t('已支付'), value: 'PAID' },
  { label: t('已取消'), value: 'CANCELLED' },
]);

/** 获取状态标签颜色（Tag 组件支持的 variant 值） */
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
  };
  return map[provider] ?? provider;
}

/** 计算剩余时间文本 */
function getRemainingText(expireAt: string, status: string, current: Date): string {
  if (status !== 'PENDING') return '--';
  const diff = new Date(expireAt).getTime() - current.getTime();
  if (diff <= 0) return t('已过期');
  const min = Math.floor(diff / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  if (min > 0) return `${min}${t('分')}${sec}${t('秒')}`;
  return `${sec}${t('秒')}`;
}

/** 是否已过期（用于标红） */
function isExpired(expireAt: string, status: string, current: Date): boolean {
  if (status !== 'PENDING') return false;
  return new Date(expireAt).getTime() - current.getTime() <= 0;
}

/** 表格列定义 */
const columns = computed<ColumnDef<OrderRow>[]>(() => [
  {
    key: 'orderNo',
    title: t('订单号'),
  },
  {
    key: 'user',
    title: t('用户'),
    render: (row) => h('span', {}, row.user?.email ?? row.user?.nickname ?? '--'),
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
    key: 'remaining',
    title: t('即将过期'),
    render: (row) =>
      h(
        'span',
        { class: isExpired(row.expireAt, row.status, now.value) ? 'text-danger-500 font-medium' : '' },
        getRemainingText(row.expireAt, row.status, now.value),
      ),
  },
  {
    key: 'paidAt',
    title: t('支付时间'),
    render: (row) => (row.paidAt ? formatDate(new Date(row.paidAt)) : '--'),
  },
  {
    key: 'created',
    title: t('创建时间'),
    render: (row) => formatDate(new Date(row.created)),
  },
]);

/** 加载订单列表 */
async function loadOrders() {
  loading.value = true;
  try {
    const result = await API.paymentApi.adminListOrders({
      ...(statusFilter.value && statusFilter.value !== ALL_STATUS ? { status: statusFilter.value } : {}),
      ...(userIdFilter.value ? { userId: userIdFilter.value } : {}),
      skip: currentPage.value * pageSize,
      take: pageSize,
    });
    orders.value = result ?? [];
    total.value = result?.length ?? 0;
  } catch (e) {
    console.error('[PaymentOrderList] 加载订单失败:', e);
  } finally {
    loading.value = false;
  }
}

watch([statusFilter, userIdFilter], () => {
  currentPage.value = 0;
  loadOrders();
});

onMounted(() => {
  loadOrders();
});
</script>
