<script setup lang="ts">
/**
 * 分页器组件（基于 reka-ui Pagination 无头 primitives）
 * 键盘导航/焦点管理交给 reka，页码窗口与省略号由 PaginationList 插槽的 items 提供
 */
import { computed } from "vue";
import {
  PaginationEllipsis,
  PaginationFirst,
  PaginationLast,
  PaginationList,
  PaginationListItem,
  PaginationNext,
  PaginationPrev,
  PaginationRoot,
} from "reka-ui";
import { Select } from "@tsfullstack/shared-frontend/components";
import { useI18n } from "@/composables/useI18n";

defineOptions({ inheritAttrs: false });

const { t } = useI18n();

interface Props {
  /** 总条数（兼容别名 totalRecords/total） */
  rows?: number;
  /** 兼容别名，等同 rows */
  totalRecords?: number;
  /** 兼容别名，等同 rows */
  total?: number;
  /** 每页条数（兼容别名 pageSize） */
  rowsPerPage?: number;
  /** 兼容别名，等同 rowsPerPage */
  pageSize?: number;
  /** 当前页码（从0开始） */
  page?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示每页条数选择器 */
  showRowsPerPageOptions?: boolean;
  /** 每页条数选项 */
  rowsPerPageOptions?: number[];
}

const {
  rows = 0,
  totalRecords,
  total,
  rowsPerPage = 10,
  pageSize,
  page = 0,
  disabled = false,
  showRowsPerPageOptions = false,
  rowsPerPageOptions = [10, 20, 50, 100],
} = defineProps<Props>();

const emit = defineEmits<{
  "update:page": [page: number];
  "update:rowsPerPage": [rowsPerPage: number];
}>();

/** 兼容别名归一后的总条数 */
const totalCount = computed(() => totalRecords ?? total ?? rows);

/** 兼容别名归一后的每页条数 */
const perPage = computed(() => pageSize ?? rowsPerPage);

/** reka 使用的 1 基页码 */
const currentPageOneBased = computed({
  get: () => page + 1,
  set: (value) => emit("update:page", value - 1),
});

/** 起始记录索引 */
const firstRecord = computed(() => (totalCount.value === 0 ? 0 : page * perPage.value + 1));

/** 结束记录索引 */
const lastRecord = computed(() =>
  totalCount.value === 0 ? 0 : Math.min((page + 1) * perPage.value, totalCount.value),
);

/** 按钮样式类 */
const buttonClasses = (active: boolean) => {
  const base = "min-w-8 px-2 py-1 text-sm border rounded transition-colors duration-200";
  const activeClass = active
    ? "bg-primary-800 text-primary-50 border-primary-800 dark:bg-primary-700 dark:text-primary-50 dark:border-primary-700"
    : "bg-primary-50 text-primary-900 border-primary-300 hover:bg-primary-100 dark:bg-primary-900 dark:text-primary-100 dark:border-primary-700 dark:hover:bg-primary-800";
  return `${base} ${activeClass}`;
};

/**
 * 处理每页条数变化
 */
function handleRowsPerPageChange(value: unknown) {
  if (typeof value !== "string") return;
  const newValue = parseInt(value, 10);
  emit("update:rowsPerPage", newValue);
  /** 切换每页条数后重置到第一页 */
  emit("update:page", 0);
}

/** 每页条数选项列表 */
const rowsPerPageSelectOptions = computed(() =>
  rowsPerPageOptions.map((value) => ({
    value: String(value),
    label: `${value} ${t("条/页")}`,
  })),
);
</script>

<template>
  <div
    v-bind="$attrs"
    class="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg"
  >
    <!-- 信息显示和每页条数选择器 -->
    <div class="flex items-center gap-4 text-sm text-primary-body">
      <div>
        {{ t("显示") }} {{ firstRecord }}-{{ lastRecord }} {{ t("条，共") }} {{ totalCount }}
        {{ t("条") }}
      </div>

      <!-- 每页条数选择器 -->
      <Select
        v-if="showRowsPerPageOptions"
        :model-value="String(perPage)"
        :options="rowsPerPageSelectOptions"
        :disabled="disabled"
        :placeholder="t('选择每页条数')"
        size="sm"
        @update:model-value="handleRowsPerPageChange"
      />
    </div>

    <!-- 分页按钮（reka Pagination 无头组件） -->
    <PaginationRoot
      :page="currentPageOneBased"
      :total="totalCount"
      :items-per-page="perPage"
      :sibling-count="1"
      show-edges
      :disabled="disabled"
      @update:page="currentPageOneBased = $event"
    >
      <PaginationList v-slot="{ items }" class="flex items-center gap-2">
        <PaginationPrev :class="buttonClasses(false)">
          {{ t("上一页") }}
        </PaginationPrev>

        <template v-for="(item, index) in items" :key="`${item.type}-${index}`">
          <PaginationListItem
            v-if="item.type === 'page'"
            :value="item.value"
            :class="buttonClasses(item.value === currentPageOneBased)"
          >
            {{ item.value }}
          </PaginationListItem>
          <PaginationEllipsis
            v-else
            :index="index"
            class="min-w-8 px-2 py-1 text-sm text-primary-body"
          >
            &#8230;
          </PaginationEllipsis>
        </template>

        <PaginationNext :class="buttonClasses(false)">
          {{ t("下一页") }}
        </PaginationNext>
      </PaginationList>
    </PaginationRoot>
  </div>
</template>
