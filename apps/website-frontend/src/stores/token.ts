import { ref, computed } from 'vue';
import { createSharedComposable } from '@vueuse/core';
import { useAPI } from '@/api';
import { useI18n } from '@/composables/useI18n';

/**
 * 代币余额
 */
export interface TokenBalance {
  monthly: number;
  yearly: number;
  permanent: number;
  total: number;
}

/**
 * 代币 Store - 全局代币状态管理
 */
/** 代币 Store 内部实现 */
const useTokenStoreImpl = () => {
  const { API } = useAPI();
  const { t } = useI18n();

  /** 代币余额 */
  const balance = ref<TokenBalance>({
    monthly: 0,
    yearly: 0,
    permanent: 0,
    total: 0,
  });

  /** 加载中 */
  const isLoading = ref(false);

  /** 最后更新时间 */
  const lastUpdated = ref<Date | null>(null);

  /** 是否有余额 */
  const hasBalance = computed(() => balance.value.total > 0);

  /** 余额是否不足 */
  const isLowBalance = computed(() => {
    return balance.value.total < 100;
  });

  /**
   * 刷新代币余额
   * @returns Promise<void> - 返回Promise以便调用者可以等待刷新完成
   */
  async function refreshBalance(force = false): Promise<void> {
    // 如果1分钟内已刷新且不强制刷新，则跳过
    if (
      !force &&
      lastUpdated.value &&
      Date.now() - lastUpdated.value.getTime() < 60000
    ) {
      return;
    }

    isLoading.value = true;
    try {
      const result = await API.tokenApi.getAvailableTokens();
      balance.value = result;
      lastUpdated.value = new Date();
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 检查代币是否足够
   */
  function checkBalance(required: number): boolean {
    return balance.value.total >= required;
  }

  /**
   * 乐观扣减余额（用于 UI 实时反馈）
   * @throws 如果余额不足会抛出错误
   */
  function optimisticallyDeduct(amount: number) {
    // 防御性检查：确保余额足够
    if (balance.value.total < amount) {
      throw new Error(t('余额不足：需要 {required}，当前 {current}', { required: amount, current: balance.value.total }));
    }

    balance.value.total -= amount;

    // 按优先级扣减：月度 > 年度 > 永久
    let remaining = amount;

    // 先扣月度
    if (balance.value.monthly >= remaining) {
      balance.value.monthly -= remaining;
      remaining = 0;
    } else {
      remaining -= balance.value.monthly;
      balance.value.monthly = 0;
    }

    // 再扣年度
    if (remaining > 0 && balance.value.yearly >= remaining) {
      balance.value.yearly -= remaining;
      remaining = 0;
    } else if (remaining > 0) {
      remaining -= balance.value.yearly;
      balance.value.yearly = 0;
    }

    // 最后扣永久
    if (remaining > 0) {
      if (balance.value.permanent < remaining) {
        throw new Error(t('永久代币不足：需要 {required}，当前 {current}', { required: remaining, current: balance.value.permanent }));
      }
      balance.value.permanent -= remaining;
      remaining = 0;
    }

    // 最终验证：确保没有负数（理论上不应该到这里，因为上面已经检查过）
    if (balance.value.monthly < 0 || balance.value.yearly < 0 || balance.value.permanent < 0) {
      throw new Error(t('代币扣减异常：余额变为负数'));
    }
  }

  /**
   * 重置余额（用于乐观更新失败后恢复）
   */
  function resetBalance() {
    refreshBalance(true);
  }

  return {
    balance,
    isLoading,
    lastUpdated,
    hasBalance,
    isLowBalance,
    refreshBalance,
    checkBalance,
    optimisticallyDeduct,
    resetBalance,
  };
};

/** 全局单例：代币状态管理 */
export const useTokenStore = createSharedComposable(useTokenStoreImpl);
