<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAPI } from '@/api';
import { Dialog, Select } from '@tsfullstack/shared-frontend/components';
import RemoteSelect from '@/components/base/RemoteSelect.vue';
import type { SelectOption } from '@tsfullstack/shared-frontend/components';

const toast = useToast();
const { API } = useAPI();

/** RemoteSelect 项目类型 */
interface SelectItem {
  value: string;
  label: string;
}

/** 用户订阅 */
interface Subscription {
  id: number;
  userId: string;
  user: {
    id: string;
    email: string;
  };
  package: {
    id: number;
    name: string;
    amount: number;
    type: string;
  };
  startDate: string;
  endDate: string | null;
  nextGrantDate: string;
  active: boolean;
  grantsCount: number;
}

/** 订阅列表 */
const subscriptions = ref<Subscription[]>([]);

/** 加载中 */
const isLoading = ref(false);

/** 显示发放代币对话框 */
const showGrantDialog = ref(false);

/** 显示订阅套餐对话框 */
const showSubscribeDialog = ref(false);

/** 套餐列表 */
const packages = ref<Array<{ id: number; name: string; amount: number; type: string }>>([]);

/** 发放代币表单 */
const grantForm = ref({
  selectedUsers: [] as SelectItem[],
  amount: 100,
  type: 'PERMANENT' as 'MONTHLY' | 'YEARLY' | 'PERMANENT',
  description: '',
});

/** 订阅表单 */
const subscribeForm = ref({
  selectedUsers: [] as SelectItem[],
  packageId: '' as string,
});

/** 提交中 */
const isSubmitting = ref(false);

/** 代币类型选项 */
const tokenTypeOptions: SelectOption[] = [
  { value: 'MONTHLY', label: '月度代币' },
  { value: 'YEARLY', label: '年度代币' },
  { value: 'PERMANENT', label: '永久代币' },
];

/** 套餐选项 */
const packageOptions = computed<SelectOption[]>(() => {
  return [
    { value: '0', label: '请选择套餐' },
    ...packages.value.map((pkg) => ({
      value: String(pkg.id),
      label: `${pkg.name} - ${pkg.amount} ${getTypeLabel(pkg.type)}`,
    })),
  ];
});

/** 过滤后的订阅列表 */
const activeSubscriptions = computed(() => {
  return subscriptions.value.filter((s) => s.active);
});

/** 加载数据 */
async function loadData() {
  isLoading.value = true;
  try {
    // 加载订阅列表
    const subs = await API.tokenPackageApi.listUserSubscriptions();
    subscriptions.value = subs as unknown as Subscription[];
  } catch (error) {
    console.error('[UserTokenManagement] 加载失败:', error);
  } finally {
    isLoading.value = false;
  }
}

/** 加载套餐列表 */
async function loadPackages() {
  try {
    const result = await API.tokenPackageApi.listTokenPackages({ active: true });
    packages.value = result as unknown as Array<{ id: number; name: string; amount: number; type: string }>;
  } catch (error) {
    console.error('[UserTokenManagement] 加载套餐失败:', error);
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
    console.error('[UserTokenManagement] 搜索用户失败:', error);
    return { data: [], total: 0 };
  }
}

/** 打开发放代币对话框 */
function openGrantDialog() {
  grantForm.value = {
    selectedUsers: [],
    amount: 100,
    type: 'PERMANENT',
    description: '',
  };
  showGrantDialog.value = true;
}

/** 打开订阅套餐对话框 */
function openSubscribeDialog() {
  subscribeForm.value = {
    selectedUsers: [],
    packageId: 0,
  };
  showSubscribeDialog.value = true;
}

/** 发放代币 */
async function grantTokens() {
  if (isSubmitting.value || grantForm.value.selectedUsers.length === 0) return;

  isSubmitting.value = true;
  let successCount = 0;
  let failCount = 0;

  try {
    // 批量发放代币
    for (const user of grantForm.value.selectedUsers) {
      try {
        await API.tokenPackageApi.grantTokens({
          userId: user.value,
          amount: grantForm.value.amount,
          type: grantForm.value.type,
          description: grantForm.value.description || undefined,
        });
        successCount++;
      } catch (error) {
        console.error(`[UserTokenManagement] 给用户 ${user.label} 发放失败:`, error);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.add({
        summary: '发放完成',
        detail: `成功给 ${successCount} 个用户发放代币${failCount > 0 ? `，${failCount} 个失败` : ''}`,
        variant: successCount === grantForm.value.selectedUsers.length ? 'success' : 'warning',
      });

      showGrantDialog.value = false;
      await loadData();
    }
  } catch (error) {
    console.error('[UserTokenManagement] 发放失败:', error);
    const errorMessage = error instanceof Error ? error.message : '发放代币失败';
    toast.add({
      summary: '发放失败',
      detail: errorMessage,
      variant: 'error',
    });
  } finally {
    isSubmitting.value = false;
  }
}

/** 订阅套餐 */
async function subscribePackage() {
  if (isSubmitting.value || subscribeForm.value.selectedUsers.length === 0 || !subscribeForm.value.packageId || subscribeForm.value.packageId === '0') return;

  isSubmitting.value = true;
  let successCount = 0;
  let failCount = 0;

  try {
    // 批量订阅套餐
    for (const user of subscribeForm.value.selectedUsers) {
      try {
        await API.tokenPackageApi.subscribePackage({
          userId: user.value,
          packageId: Number(subscribeForm.value.packageId),
        });
        successCount++;
      } catch (error) {
        console.error(`[UserTokenManagement] 用户 ${user.label} 订阅失败:`, error);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.add({
        summary: '订阅完成',
        detail: `成功给 ${successCount} 个用户订阅套餐${failCount > 0 ? `，${failCount} 个失败` : ''}`,
        variant: successCount === subscribeForm.value.selectedUsers.length ? 'success' : 'warning',
      });

      showSubscribeDialog.value = false;
      await loadData();
    }
  } catch (error) {
    console.error('[UserTokenManagement] 订阅失败:', error);
    const errorMessage = error instanceof Error ? error.message : '订阅套餐失败';
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
async function cancelSubscription(subscriptionId: number) {
  try {
    await API.tokenPackageApi.cancelSubscription(subscriptionId);

    toast.add({
      summary: '取消成功',
      detail: '订阅已取消',
      variant: 'success',
    });

    await loadData();
  } catch (error) {
    console.error('[UserTokenManagement] 取消订阅失败:', error);
    toast.add({
      summary: '取消失败',
      detail: '取消订阅失败',
      variant: 'error',
    });
  }
}

/** 格式化日期 */
function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString('zh-CN');
}

/** 获取类型标签 */
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    MONTHLY: '月度代币',
    YEARLY: '年度代币',
    PERMANENT: '永久代币',
  };
  return labels[type] || type;
}

onMounted(() => {
  loadData();
  loadPackages();
});
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- 页面头部 -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        用户代币管理
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        给用户发放代币或订阅套餐
      </p>
    </div>

    <!-- 操作按钮 -->
    <div class="mb-6 flex gap-4">
      <button
        type="button"
        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        @click="openGrantDialog"
      >
        发放代币
      </button>
      <button
        type="button"
        class="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-lg transition-colors"
        @click="openSubscribeDialog"
      >
        订阅套餐
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
      <div v-else-if="activeSubscriptions.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p class="mt-2 text-gray-600 dark:text-gray-400">暂无订阅</p>
      </div>

      <!-- 订阅列表 -->
      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="sub in activeSubscriptions"
          :key="sub.id"
          class="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-4">
                <div>
                  <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {{ sub.user.email }}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ sub.package.name }} ({{ sub.package.amount }} {{ getTypeLabel(sub.package.type) }})
                  </p>
                </div>
                <span
                  class="px-2 py-1 text-xs rounded bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200"
                >
                  活跃
                </span>
              </div>
              <div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                <p>开始时间: {{ formatDate(sub.startDate) }}</p>
                <p v-if="sub.endDate">结束时间: {{ formatDate(sub.endDate) }}</p>
                <p>下次发放: {{ formatDate(sub.nextGrantDate) }}</p>
                <p>已发放次数: {{ sub.grantsCount }}</p>
              </div>
            </div>
            <button
              type="button"
              class="px-3 py-2 text-sm bg-danger-100 dark:bg-danger-900 text-danger-700 dark:text-danger-300 rounded-lg hover:bg-danger-200 dark:hover:bg-danger-800 transition-colors"
              @click="cancelSubscription(sub.id)"
            >
              取消订阅
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 发放代币对话框 -->
    <Dialog v-model:open="showGrantDialog" title="发放代币">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            选择用户 *
          </label>
          <RemoteSelect
            v-model="grantForm.selectedUsers"
            :query-method="searchUsers"
            :show-tag="true"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            代币类型 *
          </label>
          <Select
            v-model="grantForm.type"
            :options="tokenTypeOptions"
            placeholder="请选择代币类型"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            数量 *
          </label>
          <input
            v-model.number="grantForm.amount"
            type="number"
            min="1"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            备注
          </label>
          <textarea
            v-model="grantForm.description"
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="发放原因（可选）"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            @click="showGrantDialog = false"
          >
            取消
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isSubmitting || grantForm.selectedUsers.length === 0"
            @click="grantTokens"
          >
            {{ isSubmitting ? '发放中...' : '发放' }}
          </button>
        </div>
      </template>
    </Dialog>

    <!-- 订阅套餐对话框 -->
    <Dialog v-model:open="showSubscribeDialog" title="订阅套餐">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            选择用户 *
          </label>
          <RemoteSelect
            v-model="subscribeForm.selectedUsers"
            :query-method="searchUsers"
            :show-tag="false"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            选择套餐 *
          </label>
          <Select
            v-model="subscribeForm.packageId"
            :options="packageOptions"
            placeholder="请选择套餐"
          />
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
            :disabled="isSubmitting || subscribeForm.selectedUsers.length === 0 || subscribeForm.packageId === '' || subscribeForm.packageId === '0'"
            @click="subscribePackage"
          >
            {{ isSubmitting ? '订阅中...' : '订阅' }}
          </button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
