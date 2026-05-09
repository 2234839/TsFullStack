import { ref, shallowRef, readonly, type Ref } from 'vue';
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
  /** 上次使用的 filter，翻页/改页大小时自动复用 */
  let lastFilter: Filter | undefined;
  /** 请求序号，用于丢弃过时的响应 */
  let loadSeq = 0;

  /** 加载数据 */
  async function load(filter?: Filter extends void ? never : Filter) {
    isLoading.value = true;
    if (filter !== undefined) {
      lastFilter = filter;
    }
    const seq = ++loadSeq;
    try {
      const result = await options.fetchFn({
        skip: currentPage.value * pageSize.value,
        take: pageSize.value,
        filter: (filter ?? lastFilter) as Filter,
      });
      /** 丢弃过时的响应（已有更新的请求发出） */
      if (seq !== loadSeq) return;
      items.value = result.data;
      total.value = result.total;
    } catch (error: unknown) {
      if (seq !== loadSeq) return;
      console.error('[usePaginatedQuery] 加载失败:', error);
      toast.error(t('加载失败'), t(options.errorMessage ?? '加载数据失败'));
    } finally {
      if (seq === loadSeq) {
        isLoading.value = false;
      }
    }
  }

  /** 翻页（自动复用上次 filter） */
  function goToPage(page: number) {
    currentPage.value = page;
    load();
  }

  /** 每页条数变化（自动复用上次 filter） */
  function updatePageSize(size: number) {
    pageSize.value = size;
    currentPage.value = 0;
    load();
  }

  return {
    items: readonly(items),
    total: readonly(total),
    currentPage: readonly(currentPage),
    pageSize: readonly(pageSize),
    isLoading: readonly(isLoading),
    load,
    goToPage,
    updatePageSize,
  };
}
