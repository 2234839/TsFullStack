<script setup lang="ts">
import { useAPI } from '@/api';
import MultiSelect from '@/components/base/MultiSelect.vue';
import Paginator from '@/components/base/Paginator.vue';
import RemoteSelect from '@/components/base/RemoteSelect.vue';
import Tag from '@/components/base/Tag.vue';
import DataTable from '@/components/base/DataTable.vue';
import type { ColumnDef } from '@/components/base/DataTable.vue';
import { useToast } from '@/composables/useToast';
import { TokenOptions } from '@tsfullstack/backend';
import { Dialog, Select } from '@tsfullstack/shared-frontend/components';
import { onMounted, ref, watch, h, computed } from 'vue';

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
  /** 专用类型（JSON 字符串，需要解析为数组） */
  restrictedType: string | null;
  description: string | null;
  created: string;
}

/** 代币消耗记录 */
interface TokenTransaction {
  id: number;
  amount: number;
  tokenType: string;
  userId: string;
  user: {
    id: string;
    email: string;
  };
  taskId: number;
  task: {
    id: number;
    type: string;
    title: string;
  };
  balanceSnapshot: Record<string, number>;
  note: string | null;
  created: string;
}

/** 当前激活的标签页 */
const activeTab = ref<'tokens' | 'transactions'>('tokens');

/** ========== 代币列表相关 ========== */
/** 代币列表 */
const tokens = ref<UserToken[]>([]);

/** 代币总数 */
const tokensTotal = ref(0);

/** 代币当前页（从0开始，用于 Paginator 组件） */
const tokensPage = ref(0);

/** 代币每页数量 */
const tokensPageSize = ref(10);

/** 代币搜索关键词 */
const tokensSearchKeyword = ref('');

/** ========== 代币消耗记录相关 ========== */
/** 消耗记录列表 */
const transactions = ref<TokenTransaction[]>([]);

/** 消耗记录总数 */
const transactionsTotal = ref(0);

/** 消耗记录当前页 */
const transactionsPage = ref(0);

/** 消耗记录每页数量 */
const transactionsPageSize = ref(10);

/** 消耗记录搜索关键词 */
const transactionsSearchKeyword = ref('');

/** ========== 通用状态 ========== */
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

/** ========== 数据加载 ========== */
/** 加载代币数据 */
async function loadTokens() {
  isLoading.value = true;
  try {
    const where: any = {};
    if (tokensSearchKeyword.value) {
      where.OR = [
        { user: { email: { contains: tokensSearchKeyword.value } } },
        { description: { contains: tokensSearchKeyword.value } },
      ];
    }

    const [result, total] = await Promise.all([
      API.db.token.findMany({
        where,
        orderBy: { created: 'desc' },
        skip: tokensPage.value * tokensPageSize.value,
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
      API.db.token.count({ where }),
    ]);

    tokens.value = result as unknown as UserToken[];
    tokensTotal.value = total as number;
  } catch (error) {
    console.error('[UserTokenManagement] 加载代币列表失败:', error);
    toast.add({
      summary: '加载失败',
      detail: '加载代币列表失败',
      variant: 'error',
    });
  } finally {
    isLoading.value = false;
  }
}

/** 加载代币消耗记录 */
async function loadTransactions() {
  isLoading.value = true;
  try {
    const where: any = {};
    if (transactionsSearchKeyword.value) {
      where.OR = [
        { user: { email: { contains: transactionsSearchKeyword.value } } },
        { task: { title: { contains: transactionsSearchKeyword.value } } },
      ];
    }

    const [result, total] = await Promise.all([
      API.db.tokenTransaction.findMany({
        where,
        orderBy: { created: 'desc' },
        skip: transactionsPage.value * transactionsPageSize.value,
        take: transactionsPageSize.value,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          task: {
            select: {
              id: true,
              type: true,
              title: true,
            },
          },
        },
      }),
      API.db.tokenTransaction.count({ where }),
    ]);

    transactions.value = result as unknown as TokenTransaction[];
    transactionsTotal.value = total as number;
  } catch (error) {
    console.error('[UserTokenManagement] 加载消耗记录失败:', error);
    toast.add({
      summary: '加载失败',
      detail: '加载代币消耗记录失败',
      variant: 'error',
    });
  } finally {
    isLoading.value = false;
  }
}

/** 根据当前标签页加载数据 */
function loadData() {
  if (activeTab.value === 'tokens') {
    loadTokens();
  } else {
    loadTransactions();
  }
}

/** 监听标签页切换 */
watch(activeTab, () => {
  loadData();
});

/** ========== 搜索功能 ========== */
/** 代币列表搜索 */
function searchTokens() {
  tokensPage.value = 0;
  loadTokens();
}

/** 消耗记录搜索 */
function searchTransactions() {
  transactionsPage.value = 0;
  loadTransactions();
}

/** 清空代币搜索 */
function clearTokensSearch() {
  tokensSearchKeyword.value = '';
  searchTokens();
}

/** 清空消耗记录搜索 */
function clearTransactionsSearch() {
  transactionsSearchKeyword.value = '';
  searchTransactions();
}

/** ========== 用户搜索（用于发放代币） ========== */
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

/** ========== 发放代币 ========== */
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
      await loadTokens();
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

/** ========== 分页功能 ========== */
/** 代币列表翻页 */
function goToTokensPage(page: number) {
  tokensPage.value = page;
  loadTokens();
}

/** 代币列表每页条数变化 */
function updateTokensPageSize(size: number) {
  tokensPageSize.value = size;
  tokensPage.value = 0;
  loadTokens();
}

/** 消耗记录翻页 */
function goToTransactionsPage(page: number) {
  transactionsPage.value = page;
  loadTransactions();
}

/** 消耗记录每页条数变化 */
function updateTransactionsPageSize(size: number) {
  transactionsPageSize.value = size;
  transactionsPage.value = 0;
  loadTransactions();
}

/** ========== 工具函数 ========== */
/**
 * 解析 restrictedType JSON 字符串为数组
 * @param jsonStr - JSON 字符串或 null
 * @returns 解析后的字符串数组，解析失败返回空数组
 */
function parseRestrictedType(jsonStr: string | null): string[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

/** 获取任务类型标签 */
function getTaskTypeLabel(type: string): string {
  return TokenOptions.TaskTypeLabels[type as keyof typeof TokenOptions.TaskTypeLabels] || type;
}

/** 获取任务类型标签（支持数组） */
function getRestrictedTypeLabel(type: string | string[]): string {
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

/** ========== DataTable 列定义 ========== */
/** 代币列表列定义 */
const tokenColumns = computed<ColumnDef<UserToken>[]>(() => [
  {
    key: 'user',
    title: '用户',
    width: '25%',
    render: (row) => h('div', { class: 'text-sm font-medium text-primary-900 dark:text-primary-100' }, row.user.email),
  },
  {
    key: 'type',
    title: '类型',
    width: '15%',
    render: (row) => h('div', { class: 'flex flex-wrap gap-1' }, [
      h(Tag, { value: getTypeLabel(row.type), variant: 'info' }),
      ...(parseRestrictedType(row.restrictedType).length > 0
        ? [h(Tag, { value: '专用', variant: 'warn' })]
        : []
      ),
    ]),
  },
  {
    key: 'amount',
    title: '数量',
    width: '15%',
    render: (row) => h('div', { class: 'text-sm' }, [
      h('div', { class: 'text-primary-900 dark:text-primary-100' }, `总量: ${row.amount}`),
      h('div', { class: 'text-xs text-primary-500 dark:text-primary-400' }, `已用: ${row.used} | 可用: ${getAvailableAmount(row)}`),
    ]),
  },
  {
    key: 'expiresAt',
    title: '过期时间',
    width: '15%',
    render: (row) => h('div', { class: 'text-sm text-primary-600 dark:text-primary-400' }, formatDate(row.expiresAt)),
  },
  {
    key: 'description',
    title: '备注',
    width: '20%',
    render: (row) => h('div', { class: 'text-sm' }, [
      h('div', {
        class: 'text-primary-600 dark:text-primary-400 truncate',
        title: row.description || ''
      }, row.description || '-'),
      ...(parseRestrictedType(row.restrictedType).length > 0
        ? [h('div', {
            class: 'text-xs text-warning-600 dark:text-warning-400 truncate',
            title: getRestrictedTypeLabel(parseRestrictedType(row.restrictedType))
          }, getRestrictedTypeLabel(parseRestrictedType(row.restrictedType)))]
        : []
      ),
    ]),
  },
  {
    key: 'created',
    title: '创建时间',
    width: '10%',
    render: (row) => h('div', { class: 'text-xs text-primary-500 dark:text-primary-400' }, formatDate(row.created)),
  },
]);

/** 代币消耗记录列定义 */
const transactionColumns = computed<ColumnDef<TokenTransaction>[]>(() => [
  {
    key: 'user',
    title: '用户',
    width: '25%',
    render: (row) => h('div', { class: 'text-sm font-medium text-primary-900 dark:text-primary-100' }, row.user.email),
  },
  {
    key: 'task',
    title: '任务',
    width: '17%',
    render: (row) => h('div', { class: 'text-sm' }, [
      h('div', { class: 'text-primary-900 dark:text-primary-100' }, row.task.title),
      h('div', { class: 'text-xs text-primary-500 dark:text-primary-400' }, getTaskTypeLabel(row.task.type)),
    ]),
  },
  {
    key: 'tokenType',
    title: '代币类型',
    width: '17%',
    render: (row) => h(Tag, { value: getTypeLabel(row.tokenType), variant: 'danger' }),
  },
  {
    key: 'amount',
    title: '消耗数量',
    width: '10%',
    render: (row) => h('div', { class: 'text-sm font-medium text-danger-600 dark:text-danger-400' }, `-${row.amount}`),
  },
  {
    key: 'balanceSnapshot',
    title: '余额快照',
    width: '17%',
    render: (row) => {
      if (!row.balanceSnapshot) return null;
      return h('div', { class: 'text-xs text-primary-500 dark:text-primary-400' },
        Object.entries(row.balanceSnapshot).map(([type, balance]) =>
          h('div', { key: type, class: 'truncate' }, `${getTypeLabel(type)}: ${balance}`)
        )
      );
    },
  },
  {
    key: 'created',
    title: '时间',
    width: '14%',
    render: (row) => h('div', { class: 'text-xs text-primary-500 dark:text-primary-400' }, formatDate(row.created)),
  },
]);

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- 页面头部 -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-primary-900 dark:text-primary-100">
        用户代币管理
      </h1>
      <p class="mt-2 text-primary-600 dark:text-primary-400">
        查看和管理用户代币及消耗记录
      </p>
    </div>

    <!-- 标签页导航 -->
    <div class="mb-6 border-b border-primary-200 dark:border-primary-700">
      <nav class="flex gap-6 -mb-px">
        <button
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'tokens'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:border-primary-300 dark:hover:border-primary-600'
          ]"
          @click="activeTab = 'tokens'"
        >
          代币列表
        </button>
        <button
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'transactions'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:border-primary-300 dark:hover:border-primary-600'
          ]"
          @click="activeTab = 'transactions'"
        >
          消耗记录
        </button>
      </nav>
    </div>

    <!-- 操作按钮 -->
    <div class="mb-6" v-if="activeTab === 'tokens'">
      <button type="button"
        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        @click="openGrantDialog">
        发放代币
      </button>
    </div>

    <!-- ========== 代币列表 ========== -->
    <div v-show="activeTab === 'tokens'" class="bg-white dark:bg-primary-800 rounded-lg shadow">
      <!-- 搜索栏 -->
      <div class="px-6 py-4 border-b border-primary-200 dark:border-primary-700">
        <div class="flex items-center gap-4">
          <div class="flex-1 relative">
            <input
              v-model="tokensSearchKeyword"
              type="text"
              placeholder="搜索用户邮箱或备注..."
              class="w-full px-4 py-2 pl-10 border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-primary-800 text-primary-900 dark:text-primary-100"
              @keyup.enter="searchTokens"
            />
            <svg class="absolute left-3 top-2.5 h-5 w-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            type="button"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            @click="searchTokens"
          >
            搜索
          </button>
          <button
            v-if="tokensSearchKeyword"
            type="button"
            class="px-4 py-2 bg-primary-100 dark:bg-primary-700 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-600 transition-colors"
            @click="clearTokensSearch"
          >
            清空
          </button>
        </div>
      </div>

      <!-- 数据表格 -->
      <DataTable
        :data="tokens"
        :columns="tokenColumns"
        :loading="isLoading"
        rowKey="id"
        emptyText="暂无代币记录"
        striped
        size="middle"
      />

      <!-- 分页 -->
      <div v-if="tokensTotal > 0" class="px-6 py-4 border-t border-primary-200 dark:border-primary-700">
        <Paginator
          :rows="tokensTotal"
          :rows-per-page="tokensPageSize"
          :page="tokensPage"
          :show-rows-per-page-options="true"
          @update:page="goToTokensPage"
          @update:rows-per-page="updateTokensPageSize"
        />
      </div>
    </div>

    <!-- ========== 代币消耗记录 ========== -->
    <div v-show="activeTab === 'transactions'" class="bg-white dark:bg-primary-800 rounded-lg shadow">
      <!-- 搜索栏 -->
      <div class="px-6 py-4 border-b border-primary-200 dark:border-primary-700">
        <div class="flex items-center gap-4">
          <div class="flex-1 relative">
            <input
              v-model="transactionsSearchKeyword"
              type="text"
              placeholder="搜索用户邮箱或任务标题..."
              class="w-full px-4 py-2 pl-10 border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-primary-800 text-primary-900 dark:text-primary-100"
              @keyup.enter="searchTransactions"
            />
            <svg class="absolute left-3 top-2.5 h-5 w-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            type="button"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            @click="searchTransactions"
          >
            搜索
          </button>
          <button
            v-if="transactionsSearchKeyword"
            type="button"
            class="px-4 py-2 bg-primary-100 dark:bg-primary-700 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-600 transition-colors"
            @click="clearTransactionsSearch"
          >
            清空
          </button>
        </div>
      </div>

      <!-- 数据表格 -->
      <DataTable
        :data="transactions"
        :columns="transactionColumns"
        :loading="isLoading"
        rowKey="id"
        emptyText="暂无消耗记录"
        striped
        size="middle"
      />

      <!-- 分页 -->
      <div v-if="transactionsTotal > 0" class="px-6 py-4 border-t border-primary-200 dark:border-primary-700">
        <Paginator
          :rows="transactionsTotal"
          :rows-per-page="transactionsPageSize"
          :page="transactionsPage"
          :show-rows-per-page-options="true"
          @update:page="goToTransactionsPage"
          @update:rows-per-page="updateTransactionsPageSize"
        />
      </div>
    </div>

    <!-- 发放代币对话框 -->
    <Dialog v-model:open="showGrantDialog" title="发放代币">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
            选择用户 *
          </label>
          <RemoteSelect v-model="grantForm.selectedUsers" :query-method="searchUsers" :show-tag="true" />
        </div>

        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
            代币类型 *
          </label>
          <Select v-model="grantForm.type" :options="tokenTypeOptions" placeholder="请选择代币类型" />
        </div>

        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
            专用类型
          </label>
          <MultiSelect v-model="grantForm.restrictedType" :options="taskTypeOptions" placeholder="请选择专用类型（可选）"
            selected-items-label="{0} 个类型已选择" />
          <p class="mt-1 text-xs text-primary-500 dark:text-primary-400">
            如果选择专用类型，代币只能用于指定类型的任务；不选择则可用于所有任务
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
            数量 *
          </label>
          <input v-model.number="grantForm.amount" type="number" min="1"
            class="w-full px-3 py-2 border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-primary-800 text-primary-900 dark:text-primary-100" />
        </div>

        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
            备注
          </label>
          <textarea v-model="grantForm.description" rows="2"
            class="w-full px-3 py-2 border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-primary-800 text-primary-900 dark:text-primary-100"
            placeholder="发放原因（可选）" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button type="button"
            class="px-4 py-2 bg-primary-100 dark:bg-primary-700 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-600 transition-colors"
            @click="showGrantDialog = false">
            取消
          </button>
          <button type="button"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isSubmitting || grantForm.selectedUsers.length === 0" @click="grantTokens">
            {{ isSubmitting ? '发放中...' : '发放' }}
          </button>
        </div>
      </template>
    </Dialog>
  </div>
</template>
