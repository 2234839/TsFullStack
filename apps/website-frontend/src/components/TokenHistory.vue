<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAPI } from '@/api';
import { useTokenStoreSingleton } from '@/stores/token';
import { getTypeLabel } from '@/utils/admin';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { Button } from '@/components/base';
import { getErrorMessage } from '@/utils/error';
import { formatDate } from '@/utils/format';

const { API } = useAPI();
const tokenStore = useTokenStoreSingleton();
const toast = useToast();
const { t } = useI18n();

/** 代币交易记录 */
interface TokenTransaction {
  id: number;
  amount: number;
  tokenType: string;
  created: string;
  task: {
    id: number;
    title: string;
    type: string;
    status: string;
  } | null;
  note: string | null;
}

/** 交易历史 */
const history = ref<TokenTransaction[]>([]);

/** 加载中 */
const isLoading = ref(false);

/** 当前页 */
const currentPage = ref(0);

/** 每页数量 */
const pageSize = 20;

/** 总数 */
const total = ref(0);

/** 是否有更多 */
const hasMore = computed(() => {
  return history.value.length < total.value;
});

/**
 * 加载交易历史
 */
async function loadHistory() {
  if (isLoading.value) return;

  isLoading.value = true;
  try {
    const [transactions, count] = await Promise.all([
      API.db.tokenTransaction.findMany({
        orderBy: { created: 'desc' },
        skip: currentPage.value * pageSize,
        take: pageSize,
        include: {
          task: {
            select: {
              id: true,
              title: true,
              type: true,
            },
          },
        },
      }),
      API.db.tokenTransaction.count(),
    ]);

    const newTransactions = transactions as unknown as TokenTransaction[];
    total.value = count as number;

    if (currentPage.value === 0) {
      history.value = newTransactions;
    } else {
      history.value.push(...newTransactions);
    }
  } catch (error: unknown) {
    toast.error(t('加载代币历史失败'), getErrorMessage(error));
  } finally {
    isLoading.value = false;
  }
}

/**
 * 加载更多
 */
function loadMore() {
  if (!hasMore.value || isLoading.value) return;
  currentPage.value++;
  loadHistory();
}

/**
 * 刷新
 */
function refresh() {
  currentPage.value = 0;
  total.value = 0;
  history.value = [];
  loadHistory();
  tokenStore.refreshBalance(true);
}

/** 组件挂载时加载 */
onMounted(() => {
  loadHistory();
});

/**
 * 获取类型颜色
 */
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    MONTHLY: 'text-info-600 dark:text-info-400',
    YEARLY: 'text-success-600 dark:text-success-400',
    PERMANENT: 'text-primary-600 dark:text-primary-400',
  };
  return colors[type] || 'text-secondary-600 dark:text-secondary-400';
}
</script>

<template>
  <div class="space-y-4">
    <!-- 标题栏 -->
    <div class="flex justify-between items-center">
      <h3 class="text-lg font-semibold text-primary-900 dark:text-primary-100">
        {{ t('代币使用历史') }}
      </h3>
      <Button
        variant="secondary"
        size="sm"
        :disabled="isLoading"
        :loading="isLoading"
        @click="refresh"
      >
        {{ isLoading ? t('刷新中...') : t('刷新') }}
      </Button>
    </div>

    <!-- 历史列表 -->
    <div v-if="history.length > 0" class="space-y-2">
      <div
        v-for="record in history"
        :key="record.id"
        class="p-4 bg-white dark:bg-primary-800 rounded-lg border border-primary-200 dark:border-primary-700"
      >
        <div class="flex justify-between items-start">
          <!-- 左侧：任务信息 -->
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-medium text-primary-900 dark:text-primary-100">
                {{ record.task?.title || t('未知任务') }}
              </span>
              <span
                v-if="record.tokenType"
                :class="['text-xs px-2 py-0.5 rounded-full', getTypeColor(record.tokenType)]"
              >
                {{ getTypeLabel(record.tokenType) }}
              </span>
            </div>
            <div v-if="record.note" class="text-sm text-secondary-600 dark:text-secondary-400">
              {{ record.note }}
            </div>
            <div class="text-xs text-secondary-500 dark:text-secondary-500 mt-1">
              {{ formatDate(record.created) }}
            </div>
          </div>

          <!-- 右侧：消耗数量 -->
          <div class="text-right">
            <div class="text-lg font-semibold text-danger-600 dark:text-danger-400">
              -{{ record.amount }}
            </div>
            <div class="text-xs text-secondary-500 dark:text-secondary-500">
              {{ t('代币') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="!isLoading"
      class="text-center py-12 text-secondary-500 dark:text-secondary-400"
    >
      <svg
        class="mx-auto h-12 w-12 text-secondary-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p class="mt-2">{{ t('暂无使用记录') }}</p>
    </div>

    <!-- 加载更多 -->
    <div v-if="hasMore" class="text-center">
      <Button
        variant="secondary"
        size="sm"
        :disabled="isLoading"
        :loading="isLoading"
        @click="loadMore"
      >
        {{ isLoading ? t('加载中...') : t('加载更多') }}
      </Button>
    </div>
  </div>
</template>
