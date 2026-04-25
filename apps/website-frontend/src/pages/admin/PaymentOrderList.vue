<template>
  <div class="payment-order-list-page p-6 max-w-7xl mx-auto">
    <!-- 页面标题 -->
    <PageHeader icon="pi pi-list text-primary-600 dark:text-primary-400">
      {{ t('支付订单') }}
    </PageHeader>

    <!-- 筛选栏 -->
    <Card class="p-4 mb-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-sm text-primary-600 dark:text-primary-400 whitespace-nowrap">{{ t('状态') }}:</label>
          <Select
            v-model="statusFilter"
            :options="statusOptions"
            :placeholder="t('全部')"
            class="w-36"
          />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-primary-600 dark:text-primary-400 whitespace-nowrap">{{ t('用户') }}:</label>
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
    <div v-if="!loading && orders.length === 0" class="text-center py-12 text-primary-600 dark:text-primary-400">
      <i class="pi pi-inbox text-4xl mb-4 block"></i>
      <p>{{ t('暂无订单记录') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, h } from 'vue';
import { useNow } from '@vueuse/core';
import { useAPI } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';
import { Tag, Button } from '@/components/base';
import { Select } from '@tsfullstack/shared-frontend/components';
import type { OrderStatus } from '@tsfullstack/backend';
import type { ColumnDef } from '@/components/base/DataTable.vue';
import type { PaymentApiResult } from '@/utils/apiType';
import { formatDate, formatPriceWithCurrency } from '@/utils/format';
import { getStatusVariant, getStatusLabel, getProviderName } from '@/utils/payment';
import { getErrorMessage } from '@/utils/error';
import { DEFAULT_PAGE_SIZE, ADMIN_TIME_REFRESH_MS } from '@/utils/constants';

/** 从 API 推导订单行类型 */
type AdminOrdersResult = NonNullable<PaymentApiResult<'adminListOrders'>>;
type OrderRow = AdminOrdersResult['items'][number];

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();
/** 响应式当前时间（30秒更新，用于过期倒计时显示） */
const now = useNow({ interval: ADMIN_TIME_REFRESH_MS });
const { API } = useAPI();

/** 订单列表 */
const orders = shallowRef<OrderRow[]>([]);
/** 总数 */
const total = ref(0);
/** 当前页（从0开始） */
const currentPage = ref(0);
/** 每页数量 */
const pageSize = DEFAULT_PAGE_SIZE;
/** 加载状态 */
const loading = ref(true);
/** 状态筛选（空字符串表示"全部"） */
const statusFilter = ref<OrderStatus | '' | typeof ALL_STATUS>('');
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

/** 计算剩余时间文本 */
function getRemainingText(expireAt: Date | string, status: string, current: Date): string {
  if (status !== 'PENDING') return '--';
  const diff = new Date(expireAt).getTime() - current.getTime();
  if (diff <= 0) return t('已过期');
  const min = Math.floor(diff / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  if (min > 0) return `${min}${t('分')}${sec}${t('秒')}`;
  return `${sec}${t('秒')}`;
}

/** 是否已过期（用于标红） */
function isExpired(expireAt: Date | string, status: string, current: Date): boolean {
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
    render: (row) => h('span', {}, formatPriceWithCurrency(row.amount)),
  },
  {
    key: 'provider',
    title: t('渠道'),
    render: (row) => h('span', {}, getProviderName(row.provider, t)),
  },
  {
    key: 'status',
    title: t('状态'),
    render: (row) => h(Tag, { value: getStatusLabel(row.status, t), variant: getStatusVariant(row.status) }),
  },
  {
    key: 'remaining',
    title: t('即将过期'),
    render: (row) =>
      h(
        'span',
        { class: isExpired(row.expireAt, row.status, now.value) ? 'text-danger-500 dark:text-danger-400 font-medium' : '' },
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
  {
    key: 'actions',
    title: t('操作'),
    render: (row) => {
      if (row.provider === 'WECHAT' && row.status === 'PENDING') {
        return h(Button, {
          label: confirmingOrderId.value === row.id ? t('确认中...') : t('确认到账'),
          icon: confirmingOrderId.value === row.id ? 'pi pi-spinner pi-spin' : 'pi pi-check-circle',
          variant: 'primary',
          size: 'small',
          disabled: confirmingOrderId.value !== null,
          onClick: () => handleConfirmPayment(row),
        });
      }
      return null;
    },
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
    orders.value = result?.items ?? [];
    total.value = result?.total ?? 0;
  } catch (_e: unknown) {
    toast.error(t('加载订单列表失败'));
  } finally {
    loading.value = false;
  }
}

/** 监听筛选条件变化，immediate: true 同时替代 onMounted */
watch([statusFilter, userIdFilter], () => {
  currentPage.value = 0;
  loadOrders();
}, { immediate: true });

/** 正在确认中的订单 ID（防止重复点击） */
const confirmingOrderId = ref<number | null>(null);

/**
 * 确认微信订单到账
 */
async function handleConfirmPayment(row: OrderRow) {
  const confirmed = await confirm.require({
    message: t(`确认订单 ${row.orderNo} 已通过微信转账到账？\n\n确认后将自动发放 ${row.package?.name ?? ''} 套餐的代币。`),
    header: t('确认到账'),
    acceptLabel: t('确认到账'),
    acceptProps: { variant: 'success', icon: 'pi pi-check-circle' },
    rejectLabel: t('取消'),
  });

  if (!confirmed) return;

  confirmingOrderId.value = row.id;
  try {
    await API.paymentApi.confirmOrderPayment(row.id);
    toast.success(t('订单已确认为已支付，代币已发放'));
    await loadOrders();
  } catch (error: unknown) {
    toast.error(getErrorMessage(error));
  } finally {
    confirmingOrderId.value = null;
  }
}

</script>
