<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useConfirm } from '@/composables/useConfirm';
import { useAPI } from '@/api';
import { searchUsers } from '@/utils/admin';
import Paginator from '@/components/base/Paginator.vue';
import RemoteSelect from '@/components/base/RemoteSelect.vue';
import Button from '@/components/base/Button.vue';
import DataTable from '@/components/base/DataTable.vue';
import Tag from '@/components/base/Tag.vue';
import type { ColumnDef } from '@/components/base/DataTable.vue';
import { getTypeLabel } from '@/utils/admin';
import { getErrorMessage } from '@/utils/error';

const toast = useToast();
const { t } = useI18n();
const confirm = useConfirm();
const { API } = useAPI();

/** 用户订阅记录 */
interface UserSubscription {
  id: number;
  userId: string;
  user: {
    id: string;
    email: string;
  };
  package: {
    id: number;
    name: string;
    type: 'MONTHLY' | 'YEARLY' | 'PERMANENT';
    amount: number;
  };
  startDate: string;
  endDate: string | null;
  nextGrantDate: string;
  active: boolean;
  grantsCount: number;
  created: string;
}

/** 套餐选项 */
interface PackageOption {
  value: number;
  label: string;
}

/** 订阅列表 */
const subscriptions = ref<UserSubscription[]>([]);

/** 订阅总数 */
const subscriptionsTotal = ref(0);

/** 当前页（从0开始，用于 Paginator 组件） */
const subscriptionsPage = ref(0);

/** 每页数量 */
const subscriptionsPageSize = ref(10);

/** 加载中 */
const isLoading = ref(false);

/** 显示订阅对话框 */
const showSubscribeDialog = ref(false);

/** 订阅表单 */
const subscribeForm = ref({
  selectedUsers: [] as Array<{ value: string; label: string }>,
  selectedPackages: [] as PackageOption[],
});

/** 提交中 */
const isSubmitting = ref(false);

/** 加载订阅列表 */
async function loadSubscriptions() {
  isLoading.value = true;
  try {
    const [result, total] = await Promise.all([
      API.db.userTokenSubscription.findMany({
        orderBy: { created: 'desc' },
        skip: subscriptionsPage.value * subscriptionsPageSize.value,
        take: subscriptionsPageSize.value,
        include: {
          package: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
      API.db.userTokenSubscription.count(),
    ]);

    subscriptions.value = result as unknown as UserSubscription[];
    subscriptionsTotal.value = total as number;
  } catch (error: unknown) {
    toast.add({
      summary: t('加载失败'),
      detail: t('加载订阅列表失败'),
      variant: 'error',
    });
  } finally {
    isLoading.value = false;
  }
}

/** 搜索套餐 */
async function searchPackages(params: {
  keyword: string;
  skip: number;
  take: number;
}) {
  try {
    const packages = await API.db.tokenPackage.findMany({
      where: {
        active: true,
        name: {
          contains: params.keyword,
        },
      },
      select: {
        id: true,
        name: true,
      },
      skip: params.skip,
      take: params.take,
    });

    const count = await API.db.tokenPackage.count({
      where: {
        active: true,
        name: {
          contains: params.keyword,
        },
      },
    });

    return {
      data: packages.map((p: { id: number; name: string }) => ({ value: p.id, label: p.name })),
      total: count,
    };
  } catch (error: unknown) {
    return { data: [], total: 0 };
  }
}

/** 翻页 */
function goToPage(page: number) {
  subscriptionsPage.value = page;
  loadSubscriptions();
}

/** 每页条数变化 */
function updatePageSize(size: number) {
  subscriptionsPageSize.value = size;
  subscriptionsPage.value = 0;
  loadSubscriptions();
}

/** 打开订阅对话框 */
function openSubscribeDialog() {
  subscribeForm.value = {
    selectedUsers: [],
    selectedPackages: [],
  };
  showSubscribeDialog.value = true;
}

/** 批量订阅套餐 */
async function batchSubscribe() {
  if (isSubmitting.value || subscribeForm.value.selectedUsers.length === 0 || subscribeForm.value.selectedPackages.length === 0) {
    return;
  }

  isSubmitting.value = true;
  const results: Array<{ user: string; package: string; success: boolean; error?: string }> = [];

  try {
    // 为每个用户订阅每个选中的套餐
    const promises: Promise<void>[] = [];

    for (const user of subscribeForm.value.selectedUsers) {
      for (const pkg of subscribeForm.value.selectedPackages) {
        promises.push(
          (async () => {
            try {
              await API.tokenPackageApi.subscribePackage({
                userId: user.value,
                packageId: pkg.value,
              });
              results.push({ user: user.label, package: pkg.label, success: true });
            } catch (error: unknown) {
              const errorMessage = getErrorMessage(error);
              results.push({ user: user.label, package: pkg.label, success: false, error: errorMessage });
            }
          })()
        );
      }
    }

    await Promise.allSettled(promises);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    if (successCount > 0) {
      toast.add({
        summary: t('订阅完成'),
        detail: `${t('成功订阅')} ${successCount} ${t('个套餐')}${failCount > 0 ? `，${failCount} ${t('个失败')}` : ''}`,
        variant: successCount === results.length ? 'success' : 'warning',
      });

      showSubscribeDialog.value = false;
      await loadSubscriptions();
    } else {
      toast.add({
        summary: t('订阅失败'),
        detail: t('所有订阅失败，请检查网络连接和权限'),
        variant: 'error',
      });
    }
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error, t('批量订阅失败'));
    toast.add({
      summary: t('订阅失败'),
      detail: errorMessage,
      variant: 'error',
    });
  } finally {
    isSubmitting.value = false;
  }
}

/** 取消订阅 */
async function cancelSubscription(subscription: UserSubscription) {
  const accepted = await confirm.require({
    message: `${t('确定要取消用户')}"${subscription.user.email}"${t('的套餐')}"${subscription.package.name}"${t('吗？\n\n注意：取消后不会回收已发放的代币，但会停止后续的自动发放。')}`,
    acceptProps: { variant: 'danger' },
  });
  if (!accepted) return;

  try {
    await API.tokenPackageApi.cancelSubscription(subscription.id);

    toast.add({
      summary: t('取消成功'),
      detail: t('订阅已取消，已发放的代币不会被回收'),
      variant: 'success',
    });

    await loadSubscriptions();
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error, t('取消订阅失败'));
    toast.add({
      summary: t('取消失败'),
      detail: errorMessage,
      variant: 'error',
    });
  }
}

import { formatDate, ONE_DAY_MS } from '@/utils/format';

/** 获取类型标签 — 从 utils/admin.ts 统一导入 */

/** 计算下次发放剩余天数 */
function getDaysUntilGrant(nextGrantDate: string): number {
  const now = new Date();
  const next = new Date(nextGrantDate);
  const diff = next.getTime() - now.getTime();
  return Math.ceil(diff / ONE_DAY_MS);
}

/** 获取状态标签 */
function getStatusBadge(subscription: UserSubscription) {
  const variants = ['danger', 'warn', 'success'] as const;
  type Variant = (typeof variants)[number];
  if (!subscription.active) {
    return { text: t('已取消'), variant: 'danger' as Variant };
  }
  if (subscription.endDate && new Date() > new Date(subscription.endDate)) {
    return { text: t('已过期'), variant: 'warn' as Variant };
  }
  return { text: t('进行中'), variant: 'success' as Variant };
}

/** ========== DataTable 列定义 ========== */
/** 订阅列表列定义 */
const subscriptionColumns = computed<ColumnDef<UserSubscription>[]>(() => [
  {
    key: 'user',
    title: t('用户'),
    width: '20%',
    render: (row) => h('div', { class: 'text-sm font-medium text-primary-900 dark:text-primary-100' }, row.user.email),
  },
  {
    key: 'status',
    title: t('状态'),
    width: '10%',
    render: (row) => {
      const badge = getStatusBadge(row);
      return h(Tag, { value: badge.text, variant: badge.variant });
    },
  },
  {
    key: 'package',
    title: t('套餐'),
    width: '15%',
    render: (row) => h('div', { class: 'text-sm' }, [
      h('div', { class: 'font-medium text-primary-900 dark:text-primary-100' }, row.package.name),
      h('div', { class: 'text-xs text-primary-500 dark:text-primary-400' }, `${row.package.amount} ${t('代币')}`),
    ]),
  },
  {
    key: 'type',
    title: t('类型'),
    width: '10%',
    render: (row) => h(Tag, { value: getTypeLabel(row.package.type), variant: 'info' }),
  },
  {
    key: 'startDate',
    title: t('订阅时间'),
    width: '10%',
    render: (row) => h('div', { class: 'text-sm text-primary-600 dark:text-primary-400' }, formatDate(row.startDate)),
  },
  {
    key: 'endDate',
    title: t('到期时间'),
    width: '10%',
    render: (row) => h('div', { class: 'text-sm text-primary-600 dark:text-primary-400' }, formatDate(row.endDate, { nullLabel: t('永久') })),
  },
  {
    key: 'nextGrantDate',
    title: t('下次发放'),
    width: '12%',
    render: (row) => {
      const days = getDaysUntilGrant(row.nextGrantDate);
      return h('div', { class: 'text-sm' }, [
        h('div', {
          class: days <= 7
            ? 'text-warning-600 dark:text-warning-400'
            : 'text-primary-600 dark:text-primary-400'
        }, formatDate(row.nextGrantDate)),
        h('div', { class: 'text-xs text-primary-500 dark:text-primary-400' }, `${days}${t('天后')}`),
      ]);
    },
  },
  {
    key: 'grantsCount',
    title: t('已发放'),
    width: '8%',
    render: (row) => h('div', { class: 'text-sm text-primary-900 dark:text-primary-100' }, `${row.grantsCount} ${t('次')}`),
  },
  {
    key: 'actions',
    title: t('操作'),
    width: '5%',
    render: (row) => {
      if (!row.active) {
        return h('div', { class: 'text-sm text-primary-500 dark:text-primary-400' }, t('已取消'));
      }
      return h(Button, {
        label: t('取消订阅'),
        variant: 'danger',
        size: 'small',
        onClick: () => cancelSubscription(row),
      });
    },
  },
]);

onMounted(() => {
  loadSubscriptions();
});
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- 页面头部 -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-primary-900 dark:text-primary-100">
        {{ t('用户订阅管理') }}
      </h1>
      <p class="mt-2 text-primary-600 dark:text-primary-400">
        {{ t('管理用户的套餐订阅，自动发放代币') }}
      </p>
    </div>

    <!-- 操作按钮 -->
    <div class="mb-6">
      <Button @click="openSubscribeDialog">
        {{ t('添加订阅') }}
      </Button>
    </div>

    <!-- 订阅列表 -->
    <div class="bg-white dark:bg-primary-800 rounded-lg shadow">
      <div class="px-6 py-4 border-b border-primary-200 dark:border-primary-700">
        <h2 class="text-lg font-semibold text-primary-900 dark:text-primary-100">
          {{ t('用户订阅列表') }}
        </h2>
      </div>

      <!-- 数据表格 -->
      <DataTable
        :data="subscriptions"
        :columns="subscriptionColumns"
        :loading="isLoading"
        rowKey="id"
        :emptyText="t('暂无订阅记录')"
        striped
        size="middle"
      />

      <!-- 分页 -->
      <div v-if="subscriptionsTotal > 0" class="px-6 py-4 border-t border-primary-200 dark:border-primary-700">
        <Paginator
          :rows="subscriptionsTotal"
          :rows-per-page="subscriptionsPageSize"
          :page="subscriptionsPage"
          :show-rows-per-page-options="true"
          @update:page="goToPage"
          @update:rows-per-page="updatePageSize"
        />
      </div>
    </div>

    <!-- 添加订阅对话框 -->
    <Dialog v-model:open="showSubscribeDialog" :title="t('添加订阅')">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
            {{ t('选择用户 *') }}
          </label>
          <RemoteSelect
            v-model="subscribeForm.selectedUsers"
            :query-method="searchUsers"
            :show-tag="true"
            :placeholder="t('搜索用户邮箱')"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
            {{ t('选择套餐 *') }}
          </label>
          <RemoteSelect
            v-model="subscribeForm.selectedPackages"
            :query-method="searchPackages"
            :show-tag="true"
            :placeholder="t('搜索套餐名称')"
          />
        </div>

        <div class="bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-lg p-3">
          <p class="text-sm text-info-800 dark:text-info-200">
            <strong>{{ t('提示：') }}</strong>
          </p>
          <ul class="text-sm text-info-700 dark:text-info-300 list-disc list-inside mt-1 space-y-1">
            <li>{{ t('订阅后会立即发放第一批代币') }}</li>
            <li>{{ t('月度套餐每30天自动发放一次') }}</li>
            <li>{{ t('年度套餐每365天自动发放一次') }}</li>
            <li>{{ t('取消订阅不会回收已发放的代币') }}</li>
          </ul>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            variant="secondary"
            @click="showSubscribeDialog = false"
          >
            {{ t('取消') }}
          </Button>
          <Button
            :disabled="isSubmitting || subscribeForm.selectedUsers.length === 0 || subscribeForm.selectedPackages.length === 0"
            :loading="isSubmitting"
            @click="batchSubscribe"
          >
            {{ isSubmitting ? t('订阅中...') : t('订阅') }}
          </Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
