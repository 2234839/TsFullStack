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
            placeholder={t('全部')}
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
      <Button :label="t('去购买套餐')" icon="pi pi-shopping-cart" variant="outline" class="mt-4" @click="goToPricing" />
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
import type { ColumnDef } from '@/components/base/DataTable.vue';
import type { OrderStatus, Order, PaymentProvider } from '@tsfullstack/backend';
import { formatDate } from '@/utils/format';

const toast = useToast();
const { t } = useI18n();
const { API } = useAPI();

/** 订单列表 */
const orders = ref<Order[]>([]);
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
function getStatusVariant(status: string): 'warning' | 'success' | 'danger' | 'info' | 'secondary' {
  const map: Record<string, 'warning' | 'success' | 'danger' | 'info' | 'secondary'> = {
    PENDING: 'warning',
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
function getProviderName(provider: string): string {
  const map: Record<string, string> = {
    MBD: t('面包多'),
    AFDIAN: t('爱发电'),
  };
  return map[provider] ?? provider;
}

/** 表格列定义 */
const columns = computed<ColumnDef[]>(() => [
  {
    id: 'orderNo',
    header: t('订单号'),
    accessorFn: (row) => row.orderNo,
  },
  {
    id: 'package',
    header: t('套餐'),
    cell: (row) => h('span', {}, row.package?.name ?? '--'),
  },
  {
    id: 'amount',
    header: t('金额'),
    cell: (row) => h('span', {}, `${(row.amount / 100).toFixed(2)}${t('元')}`),
  },
  {
    id: 'provider',
    header: t('渠道'),
    cell: (row) => h('span', {}, getProviderName(row.provider)),
  },
  {
    id: 'status',
    header: t('状态'),
    cell: (row) => h(Tag, { value: getStatusLabel(row.status), variant: getStatusVariant(row.status) }),
  },
  {
    id: 'created',
    header: t('创建时间'),
    accessorFn: (row) => formatDate(new Date(row.created)),
  },
  {
    id: 'actions',
    header: t('操作'),
    cell: (row) => {
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
    orders.value = result?.orders ?? [];
    total.value = result?.total ?? 0;
  } catch (e) {
    console.error('[OrderList] 加载订单失败:', e);
  } finally {
    loading.value = false;
  }
}

/** 去支付（重新打开支付链接） */
async function handleRepay(order: Order) {
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

watch(statusFilter, () => {
  currentPage.value = 0;
  loadOrders();
});

onMounted(() => {
  loadOrders();
});
</script>
