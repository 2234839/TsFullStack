<script lang="ts">
/** DataTable 列定义类型 */
export interface ColumnDef<T = unknown> {
  /** 字段名 */
  key: string;
  /** 列头 */
  title: string;
  /** 是否可排序 */
  sortable?: boolean;
  /** 列宽 */
  width?: string | number;
  /** 单元格自定义渲染 */
  render?: (row: T, index: number) => import('vue').VNode | string | null;
  /** 列对齐 */
  align?: 'left' | 'center' | 'right';
}
</script>

<script setup lang="ts" generic="T extends Record<string, any>">
/**
 * 数据表格组件
 * 使用 Tailwind CSS 样式
 * 提供排序、分页、行选择等功能
 */
import { computed, ref, isVNode, h, type VNode } from 'vue';
import { useI18n } from '@/composables/useI18n';
import ProgressSpinner from './ProgressSpinner.vue';

const { t } = useI18n();

interface Props<T> {
  /** 数据列表 */
  data: T[];
  /** 列定义 */
  columns: ColumnDef<T>[];
  /** 数据键（用于行选择和唯一标识） */
  rowKey?: string;
  /** 加载状态 */
  loading?: boolean;
  /** 是否显示斑马纹 */
  striped?: boolean;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 空消息 */
  emptyText?: string;
  /** 表格大小 */
  size?: 'small' | 'middle' | 'large';
  /** 选中的行 */
  selectedRowKeys?: (string | number)[];
  /** 是否支持行选择 */
  selectable?: boolean;
}

const props = withDefaults(defineProps<Props<T>>(), {
  rowKey: 'id',
  loading: false,
  striped: true,
  bordered: false,
  emptyText: '暂无数据',
  size: 'middle',
  selectedRowKeys: () => [],
  selectable: false,
});

/** 空数据提示文本 */
const emptyText = computed(() => t(props.emptyText));

const emit = defineEmits<{
  'update:selectedRowKeys': [keys: (string | number)[]];
  'rowClick': [row: T, index: number];
}>();

/** 排序状态 */
const sortState = ref<{
  field: string | null;
  order: 'asc' | 'desc';
}>({
  field: null,
  order: 'asc',
});

/** 处理排序 */
function handleSort(column: ColumnDef<T>) {
  if (!column.sortable) return;

  if (sortState.value.field === column.key) {
    sortState.value.order = sortState.value.order === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.value.field = column.key;
    sortState.value.order = 'asc';
  }
}

/** 排序后的数据 */
const sortedData = computed(() => {
  if (!sortState.value.field) return props.data;

  return [...props.data].sort((a, b) => {
    const aVal = a[sortState.value.field!];
    const bVal = b[sortState.value.field!];

    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    const compareResult = aVal < bVal ? -1 : 1;
    return sortState.value.order === 'asc' ? compareResult : -compareResult;
  });
});

/** 选中键的 Set 缓存，避免 Array.includes 的 O(n) 查找 */
const selectedKeySet = computed(() => new Set<string | number>(props.selectedRowKeys));

/** 检查是否选中 */
function isSelected(row: T): boolean {
  return selectedKeySet.value.has(row[props.rowKey]);
}

/** 处理行选择 */
function handleRowSelect(row: T) {
  if (!props.selectable) return;

  const key = row[props.rowKey];
  const selectionSet = new Set(props.selectedRowKeys);

  if (selectionSet.has(key)) {
    selectionSet.delete(key);
  } else {
    selectionSet.add(key);
  }

  emit('update:selectedRowKeys', [...selectionSet]);
}

/** 全选/取消全选 */
function handleSelectAll(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.checked) {
    emit('update:selectedRowKeys', props.data.map(row => row[props.rowKey]));
  } else {
    emit('update:selectedRowKeys', []);
  }
}

/** 是否全选 */
const isAllSelected = computed(() => {
  return props.data.length > 0 && props.selectedRowKeys.length === props.data.length;
});

/** 是否部分选中 */
const isSomeSelected = computed(() => {
  return props.selectedRowKeys.length > 0 && props.selectedRowKeys.length < props.data.length;
});

/** 表格尺寸配置 */
const sizeConfig = {
  small: {
    cell: 'px-2 py-1',
    header: 'px-2 py-1',
    text: 'text-xs',
  },
  middle: {
    cell: 'px-3 py-2',
    header: 'px-3 py-2',
    text: 'text-sm',
  },
  large: {
    cell: 'px-4 py-3',
    header: 'px-4 py-3',
    text: 'text-base',
  },
};

/** 获取排序图标 */
function getSortIcon(column: ColumnDef<T>) {
  if (sortState.value.field !== column.key) return null;
  return sortState.value.order === 'asc' ? '↑' : '↓';
}

/** 将 render 结果统一为 VNode（string 用 span 包裹，null 渲染为空 span） */
function normalizeRenderResult(result: VNode | string | null): VNode {
  if (result === null) return h('span', '');
  if (isVNode(result)) return result;
  return h('span', result);
}
</script>

<template>
  <div class="data-table-wrapper">
    <!-- 加载遮罩层 -->
    <div v-if="props.loading" class="data-table-loading-overlay">
      <ProgressSpinner />
    </div>

    <!-- 数据表格 -->
    <div class="data-table-container" :class="{ 'opacity-50': props.loading }">
      <table class="border-collapse w-full">
        <thead class="bg-primary-50 dark:bg-primary-900">
          <tr>
            <!-- 选择列 -->
            <th v-if="props.selectable" :class="[sizeConfig[props.size].header, 'w-12 text-center']">
              <input
                type="checkbox"
                :checked="isAllSelected"
                :indeterminate="isSomeSelected"
                @change="handleSelectAll"
                class="h-4 w-4 rounded border-primary-300 dark:border-primary-600 text-primary-700 dark:text-primary-400 focus:ring-primary-600 dark:focus:ring-primary-400"
              />
            </th>
            <!-- 数据列 -->
            <th
              v-for="column in props.columns"
              :key="column.key"
              :class="[
                sizeConfig[props.size].header,
                'text-left text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wider',
                { 'cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-800': column.sortable }
              ]"
              :style="{ width: typeof column.width === 'number' ? `${column.width}px` : column.width }"
              @click="column.sortable ? handleSort(column) : null">
              <div class="flex items-center gap-2">
                {{ column.title }}
                <span v-if="column.sortable" class="text-primary-500 dark:text-primary-400">
                  {{ getSortIcon(column) }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="bg-primary-50 dark:bg-primary-950">
          <!-- 空数据 -->
          <tr v-if="sortedData.length === 0">
            <td :colspan="props.columns.length + (props.selectable ? 1 : 0)" class="px-4 py-8 text-center text-primary-600 dark:text-primary-400">
              {{ emptyText }}
            </td>
          </tr>
          <!-- 数据行 -->
          <tr
            v-else
            v-for="(row, rowIndex) in sortedData"
            :key="row[props.rowKey] || rowIndex"
            :class="[
              'border-b border-primary-200 dark:border-primary-700 transition-colors',
              {
                'bg-primary-100 dark:bg-primary-900/50': props.striped && rowIndex % 2 === 0,
                'hover:bg-primary-200 dark:hover:bg-primary-800': props.selectable,
                'border': props.bordered,
              }
            ]">
            <!-- 选择列 -->
            <td v-if="props.selectable" :class="[sizeConfig[props.size].cell, 'text-center']">
              <input
                type="checkbox"
                :checked="isSelected(row)"
                @change="handleRowSelect(row)"
                class="h-4 w-4 rounded border-primary-300 dark:border-primary-600 text-primary-700 dark:text-primary-400 focus:ring-primary-600 dark:focus:ring-primary-400"
              />
            </td>
            <!-- 数据单元格 -->
            <td
              v-for="column in props.columns"
              :key="column.key"
              :class="[
                sizeConfig[props.size].cell,
                sizeConfig[props.size].text,
                {
                  'text-center': column.align === 'center',
                  'text-right': column.align === 'right',
                  'text-left': !column.align || column.align === 'left',
                }
              ]">
              <!-- 自定义渲染（统一处理 VNode 和 string） -->
              <component
                v-if="column.render"
                :is="normalizeRenderResult(column.render(row, rowIndex))"
              />
              <!-- 默认显示 -->
              <span v-else>{{ row[column.key] }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/** DataTable 外层包装器 */
.data-table-wrapper {
  position: relative;
  width: 100%;
}

/** 加载遮罩层 */
.data-table-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: color-mix(in srgb, var(--color-white) 75%, transparent);
  backdrop-filter: blur(2px);
  z-index: 10;
  border-radius: 0.5rem;
}

.dark .data-table-loading-overlay {
  background-color: color-mix(in srgb, var(--color-gray-900) 50%, transparent);
}

/** DataTable 容器 - 支持横向滚动 */
.data-table-container {
  width: 100%;
  overflow-x: auto;
  position: relative;
  transition: opacity 150ms ease-out;
}

.data-table-container.opacity-50 {
  opacity: 0.5;
  pointer-events: none;
}

/** 美化滚动条（使用 CSS 变量支持主题切换） */
.data-table-container {
  --scrollbar-track: var(--color-zinc-100, #f4f4f5);
  --scrollbar-thumb: var(--color-zinc-300, #d4d4d8);
  --scrollbar-thumb-hover: var(--color-zinc-400, #a1a1aa);

  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.dark .data-table-container {
  --scrollbar-track: var(--color-zinc-900, #18181b);
  --scrollbar-thumb: var(--color-zinc-700, #3f3f46);
  --scrollbar-thumb-hover: var(--color-zinc-500, #71717a);
}

.data-table-container::-webkit-scrollbar {
  height: 10px;
}

.data-table-container::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 5px;
}

.data-table-container::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 5px;
  transition: background-color 150ms ease-out;
}

.data-table-container::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
</style>
