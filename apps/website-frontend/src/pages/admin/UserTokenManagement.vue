<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAPI } from '@/api';
import { Dialog, Select } from '@tsfullstack/shared-frontend/components';
import RemoteSelect from '@/components/base/RemoteSelect.vue';
import MultiSelect from '@/components/base/MultiSelect.vue';
import { TokenOptions } from '@tsfullstack/backend';

const toast = useToast();
const { API } = useAPI();

/** RemoteSelect 项目类型 */
interface SelectItem {
  value: string;
  label: string;
}

/** 用户代币记录 */
interface UserToken {
  id: number;
  userId: string;
  user: {
    id: string;
    email: string;
  };
  type: string;
  amount: number;
  used: number;
  expiresAt: string | null;
  restrictedType: string[] | null;
  description: string | null;
  created: string;
}

/** 代币列表 */
const tokens = ref<UserToken[]>([]);

/** 代币总数 */
const tokensTotal = ref(0);

/** 代币当前页 */
const tokensPage = ref(1);

/** 代币每页数量 */
const tokensPageSize = ref(10);

/** 计算总页数 */
const tokensTotalPages = computed(() => Math.ceil(tokensTotal.value / tokensPageSize.value));

/** 加载中 */
const isLoading = ref(false);

/** 显示发放代币对话框 */
const showGrantDialog = ref(false);

/** 发放代币表单 */
const grantForm = ref({
  selectedUsers: [] as SelectItem[],
  amount: 100,
  type: 'PERMANENT' as 'MONTHLY' | 'YEARLY' | 'PERMANENT',
  description: '',
  restrictedType: [] as string[],
});

/** 提交中 */
const isSubmitting = ref(false);

/** 代币类型选项（从后端导入） */
const tokenTypeOptions = TokenOptions.TokenTypeOptions;

/** 任务类型选项（从后端导入，用于专用代币） */
const taskTypeOptions = TokenOptions.TaskTypeOptions;

/** 加载代币数据 */
async function loadData() {
  isLoading.value = true;
  try {
    const [result, total] = await Promise.all([
      API.db.token.findMany({
        orderBy: { created: 'desc' },
        skip: (tokensPage.value - 1) * tokensPageSize.value,
        take: tokensPageSize.value,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
      API.db.token.count(),
    ]);

    tokens.value = result as unknown as UserToken[];
    tokensTotal.value = total as number;
  } catch (error) {
    console.error('[UserTokenManagement] 加载失败:', error);
    toast.add({
      summary: '加载失败',
      detail: '加载代币列表失败',
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
    restrictedType: [],
  };
  showGrantDialog.value = true;
}

/** 翻页 */
function goToPage(page: number) {
  tokensPage.value = page;
  loadData();
}

/** 发放代币 */
async function grantTokens() {
  if (isSubmitting.value || grantForm.value.selectedUsers.length === 0) return;

  isSubmitting.value = true;
  const results: Array<{ user: string; success: boolean; error?: string }> = [];

  try {
    // 并行发放（提高性能）
    const promises = grantForm.value.selectedUsers.map(async (user) => {
      try {
        await API.tokenPackageApi.grantTokens({
          userId: user.value,
          amount: grantForm.value.amount,
          type: grantForm.value.type,
          description: grantForm.value.description || undefined,
          ...(grantForm.value.restrictedType.length > 0 && { restrictedType: grantForm.value.restrictedType }),
        });
        return { user: user.label, success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        console.error(`[UserTokenManagement] 给用户 ${user.label} 发放失败:`, error);
        return { user: user.label, success: false, error: errorMessage };
      }
    });

    const settled = await Promise.allSettled(promises);
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const user = grantForm.value.selectedUsers[index];
        results.push({
          user: user?.label || '未知用户',
          success: false,
          error: '请求失败',
        });
      }
    });

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    if (successCount > 0) {
      toast.add({
        summary: '发放完成',
        detail: `成功给 ${successCount} 个用户发放代币${failCount > 0 ? `，${failCount} 个失败` : ''}`,
        variant: successCount === results.length ? 'success' : 'warning',
      });

      // 显示详细结果
      if (failCount > 0) {
        const failedUsers = results.filter((r) => !r.success).map((r) => r.user);
        console.warn('[UserTokenManagement] 失败用户:', failedUsers);
      }

      showGrantDialog.value = false;
      await loadData();
    } else {
      toast.add({
        summary: '发放失败',
        detail: '所有用户发放失败，请检查网络连接和权限',
        variant: 'error',
      });
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

/** 格式化日期 */
function formatDate(date: string | Date | null): string {
  if (!date) return '永不过期';
  return new Date(date).toLocaleString('zh-CN');
}

/** 获取类型标签 */
function getTypeLabel(type: string): string {
  return TokenOptions.TokenTypeLabels[type as keyof typeof TokenOptions.TokenTypeLabels] || type;
}

/** 获取任务类型标签（支持数组） */
function getTaskTypeLabel(type: string | string[]): string {
  if (Array.isArray(type)) {
    if (type.length === 0) return '通用代币';
    return type.map(t => TokenOptions.TaskTypeLabels[t as keyof typeof TokenOptions.TaskTypeLabels] || t).join('、');
  }
  return TokenOptions.TaskTypeLabels[type as keyof typeof TokenOptions.TaskTypeLabels] || type;
}

/** 计算可用数量 */
function getAvailableAmount(token: UserToken): number {
  return token.amount - token.used;
}

onMounted(() => {
  loadData();
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
        给用户发放代币
      </p>
    </div>

    <!-- 操作按钮 -->
    <div class="mb-6">
      <button
        type="button"
        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        @click="openGrantDialog"
      >
        发放代币
      </button>
    </div>

    <!-- 代币列表 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          用户代币列表
        </h2>
      </div>

      <!-- 加载中 -->
      <div v-if="isLoading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="tokens.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p class="mt-2 text-gray-600 dark:text-gray-400">暂无代币记录</p>
      </div>

      <!-- 代币列表 -->
      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="token in tokens"
          :key="token.id"
          class="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3">
                <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {{ token.user.email }}
                </h3>
                <span
                  class="px-2 py-1 text-xs rounded bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200"
                >
                  {{ getTypeLabel(token.type) }}
                </span>
                <span
                  v-if="token.restrictedType"
                  class="px-2 py-1 text-xs rounded bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200"
                >
                  专用: {{ getTaskTypeLabel(token.restrictedType) }}
                </span>
              </div>
              <div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                <p>总量: {{ token.amount }} | 已用: {{ token.used }} | 可用: {{ getAvailableAmount(token) }}</p>
                <p>过期时间: {{ formatDate(token.expiresAt) }}</p>
                <p v-if="token.description">备注: {{ token.description }}</p>
                <p>创建时间: {{ formatDate(token.created) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="tokensTotalPages > 1" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            共 {{ tokensTotal }} 条记录，第 {{ tokensPage }} / {{ tokensTotalPages }} 页
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="tokensPage === 1"
              @click="goToPage(tokensPage - 1)"
            >
              上一页
            </button>
            <button
              type="button"
              class="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="tokensPage === tokensTotalPages"
              @click="goToPage(tokensPage + 1)"
            >
              下一页
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
            专用类型
          </label>
          <MultiSelect
            v-model="grantForm.restrictedType"
            :options="taskTypeOptions"
            placeholder="请选择专用类型（可选）"
            selected-items-label="{0} 个类型已选择"
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            如果选择专用类型，代币只能用于指定类型的任务；不选择则可用于所有任务
          </p>
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
  </div>
</template>
