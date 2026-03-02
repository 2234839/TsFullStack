<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAPI } from '@/api';
import { Dialog } from '@tsfullstack/shared-frontend/components';
import Paginator from '@/components/base/Paginator.vue';
import RemoteSelect from '@/components/base/RemoteSelect.vue';
import Button from '@/components/base/Button.vue';
import { TokenOptions } from '@tsfullstack/backend';

const toast = useToast();
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
  } catch (error) {
    console.error('[UserSubscriptionManagement] 加载失败:', error);
    toast.add({
      summary: '加载失败',
      detail: '加载订阅列表失败',
      variant: 'error',
    });
  } finally {
    isLoading.value = false;
  }
}

/** 搜索用户 */
async function searchUsers(params: {
  keyword: string;
  skip: number;
  take: number;
}) {
  try {
    const users = await API.db.user.findMany({
      where: {
        email: {
          contains: params.keyword,
        },
      },
      select: {
        id: true,
        email: true,
      },
      skip: params.skip,
      take: params.take,
    });

    const count = await API.db.user.count({
      where: {
        email: {
          contains: params.keyword,
        },
      },
    });

    return {
      data: users.map((u: { id: string; email: string }) => ({ value: u.id, label: u.email })),
      total: count,
    };
  } catch (error) {
    console.error('[UserSubscriptionManagement] 搜索用户失败:', error);
    return { data: [], total: 0 };
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
  } catch (error) {
    console.error('[UserSubscriptionManagement] 搜索套餐失败:', error);
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
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : '未知错误';
              console.error(`[UserSubscriptionManagement] 用户 ${user.label} 订阅 ${pkg.label} 失败:`, error);
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
        summary: '订阅完成',
        detail: `成功订阅 ${successCount} 个套餐${failCount > 0 ? `，${failCount} 个失败` : ''}`,
        variant: successCount === results.length ? 'success' : 'warning',
      });

      showSubscribeDialog.value = false;
      await loadSubscriptions();
    } else {
      toast.add({
        summary: '订阅失败',
        detail: '所有订阅失败，请检查网络连接和权限',
        variant: 'error',
      });
    }
  } catch (error) {
    console.error('[UserSubscriptionManagement] 批量订阅失败:', error);
    const errorMessage = error instanceof Error ? error.message : '批量订阅失败';
    toast.add({
      summary: '订阅失败',
      detail: errorMessage,
      variant: 'error',
    });
  } finally {
    isSubmitting.value = false;
  }
}

/** 取消订阅 */
async function cancelSubscription(subscription: UserSubscription) {
  if (!confirm(`确定要取消用户"${subscription.user.email}"的套餐"${subscription.package.name}"吗？\n\n注意：取消后不会回收已发放的代币，但会停止后续的自动发放。`)) {
    return;
  }

  try {
    await API.tokenPackageApi.cancelSubscription(subscription.id);

    toast.add({
      summary: '取消成功',
      detail: '订阅已取消，已发放的代币不会被回收',
      variant: 'success',
    });

    await loadSubscriptions();
  } catch (error) {
    console.error('[UserSubscriptionManagement] 取消订阅失败:', error);
    const errorMessage = error instanceof Error ? error.message : '取消订阅失败';
    toast.add({
      summary: '取消失败',
      detail: errorMessage,
      variant: 'error',
    });
  }
}

/** 格式化日期 */
function formatDate(date: string | Date | null): string {
  if (!date) return '永久';
  return new Date(date).toLocaleString('zh-CN');
}

/** 获取类型标签 */
function getTypeLabel(type: string): string {
  return TokenOptions.TokenTypeLabels[type as keyof typeof TokenOptions.TokenTypeLabels] || type;
}

/** 计算下次发放剩余天数 */
function getDaysUntilGrant(nextGrantDate: string): number {
  const now = new Date();
  const next = new Date(nextGrantDate);
  const diff = next.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** 获取状态标签 */
function getStatusBadge(subscription: UserSubscription) {
  if (!subscription.active) {
    return { text: '已取消', variant: 'danger' };
  }
  if (subscription.endDate && new Date() > new Date(subscription.endDate)) {
    return { text: '已过期', variant: 'warning' };
  }
  return { text: '进行中', variant: 'success' };
}

onMounted(() => {
  loadSubscriptions();
});
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- 页面头部 -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        用户订阅管理
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        管理用户的套餐订阅，自动发放代币
      </p>
    </div>

    <!-- 操作按钮 -->
    <div class="mb-6">
      <button
        type="button"
        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        @click="openSubscribeDialog"
      >
        添加订阅
      </button>
    </div>

    <!-- 订阅列表 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          用户订阅列表
        </h2>
      </div>

      <!-- 加载中 -->
      <div v-if="isLoading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="subscriptions.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p class="mt-2 text-gray-600 dark:text-gray-400">暂无订阅记录</p>
      </div>

      <!-- 订阅列表 -->
      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="sub in subscriptions"
          :key="sub.id"
          class="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {{ sub.user.email }}
                </h3>
                <span
                  class="px-2 py-1 text-xs rounded"
                  :class="{
                    'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200': getStatusBadge(sub).variant === 'success',
                    'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200': getStatusBadge(sub).variant === 'warning',
                    'bg-danger-100 text-danger-800 dark:bg-danger-900 dark:text-danger-200': getStatusBadge(sub).variant === 'danger',
                  }"
                >
                  {{ getStatusBadge(sub).text }}
                </span>
                <span class="px-2 py-1 text-xs rounded bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                  {{ getTypeLabel(sub.package.type) }}
                </span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <span class="font-medium">套餐：</span>
                  <span>{{ sub.package.name }}（{{ sub.package.amount }} 代币）</span>
                </div>
                <div>
                  <span class="font-medium">订阅时间：</span>
                  <span>{{ formatDate(sub.startDate) }}</span>
                </div>
                <div>
                  <span class="font-medium">到期时间：</span>
                  <span>{{ formatDate(sub.endDate) }}</span>
                </div>
                <div>
                  <span class="font-medium">下次发放：</span>
                  <span :class="{ 'text-warning-600 dark:text-warning-400': getDaysUntilGrant(sub.nextGrantDate) <= 7 }">
                    {{ formatDate(sub.nextGrantDate) }}（{{ getDaysUntilGrant(sub.nextGrantDate) }}天后）
                  </span>
                </div>
                <div>
                  <span class="font-medium">已发放次数：</span>
                  <span>{{ sub.grantsCount }} 次</span>
                </div>
              </div>
            </div>

            <div class="ml-4">
              <Button
                v-if="sub.active"
                type="button"
                class="px-3 py-2 text-sm bg-danger-100 hover:bg-danger-200 dark:bg-danger-900 dark:hover:bg-danger-800 text-danger-700 dark:text-danger-300 rounded-lg transition-colors"
                @click="cancelSubscription(sub)"
              >
                取消订阅
              </Button>
              <div v-else class="text-sm text-gray-500 dark:text-gray-400">
                已取消
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="subscriptionsTotal > 0" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
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
    <Dialog v-model:open="showSubscribeDialog" title="添加订阅">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            选择用户 *
          </label>
          <RemoteSelect
            v-model="subscribeForm.selectedUsers"
            :query-method="searchUsers"
            :show-tag="true"
            placeholder="搜索用户邮箱"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            选择套餐 *
          </label>
          <RemoteSelect
            v-model="subscribeForm.selectedPackages"
            :query-method="searchPackages"
            :show-tag="true"
            placeholder="搜索套餐名称"
          />
        </div>

        <div class="bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-lg p-3">
          <p class="text-sm text-info-800 dark:text-info-200">
            <strong>提示：</strong>
          </p>
          <ul class="text-sm text-info-700 dark:text-info-300 list-disc list-inside mt-1 space-y-1">
            <li>订阅后会立即发放第一批代币</li>
            <li>月度套餐每30天自动发放一次</li>
            <li>年度套餐每365天自动发放一次</li>
            <li>取消订阅不会回收已发放的代币</li>
          </ul>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            @click="showSubscribeDialog = false"
          >
            取消
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isSubmitting || subscribeForm.selectedUsers.length === 0 || subscribeForm.selectedPackages.length === 0"
            @click="batchSubscribe"
          >
            {{ isSubmitting ? '订阅中...' : '订阅' }}
          </button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
