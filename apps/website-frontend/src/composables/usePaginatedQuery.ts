import { ref, shallowRef, type Ref } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';

/** 分页查询 composable 的配置 */
interface PaginatedQueryOptions<T, Filter = void> {
  /** 数据获取函数，接收 { skip, take, filter } 返回 { data, total } */
  fetchFn: (params: { skip: number; take: number; filter: Filter }) => Promise<{ data: T[]; total: number }>;
  /** 初始每页数量 */
  pageSize?: number;
  /** 加载失败时的错误提示 */
  errorMessage?: string;
}

/** 通用分页查询 composable */
export function usePaginatedQuery<T, Filter = void>(options: PaginatedQueryOptions<T, Filter>) {
  const toast = useToast();
  const { t } = useI18n();

  /** 数据列表（API 响应整体替换，无需深层响应式） */
  const items = shallowRef<T[]>([]) as Ref<T[]>;
  /** 总数 */
  const total = ref(0);
  /** 当前页（从0开始） */
  const currentPage = ref(0);
  /** 每页数量 */
  const pageSize = ref(options.pageSize ?? DEFAULT_PAGE_SIZE);
  /** 加载中 */
  const isLoading = ref(false);

  /** 加载数据 */
  async function load(filter?: Filter extends void ? never : Filter) {
    isLoading.value = true;
    try {
      const result = await options.fetchFn({
        skip: currentPage.value * pageSize.value,
        take: pageSize.value,
        filter: filter as Filter,
      });
      items.value = result.data;
      total.value = result.total;
    } catch {
      toast.error(t('加载失败'), t(options.errorMessage ?? '加载数据失败'));
    } finally {
      isLoading.value = false;
    }
  }

  /** 翻页 */
  function goToPage(page: number) {
    currentPage.value = page;
    load();
  }

  /** 每页条数变化 */
  function updatePageSize(size: number) {
    pageSize.value = size;
    currentPage.value = 0;
    load();
  }

  return {
    items,
    total,
    currentPage,
    pageSize,
    isLoading,
    load,
    goToPage,
    updatePageSize,
  };
}
