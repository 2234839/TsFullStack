<script setup lang="ts">
/**
 * 数据表格组件
 * 使用 Tailwind CSS 样式
 * 简化版，替代 PrimeVue DataTable
 */
import { computed, ref } from 'vue';

interface Column {
  /** 字段名 */
  field?: string;
  /** 列头 */
  header?: string;
  /** 是否可排序 */
  sortable?: boolean;
  /** 列宽 */
  style?: string;
  /** 列对齐 */
  align?: 'left' | 'center' | 'right';
}

interface Props {
  /** 数据列表 */
  value?: any[];
  /** 列定义（通过 Column 子组件定义） */
  columns?: Column[];
  /** 数据键 */
  dataKey?: string;
  /** 加载状态 */
  loading?: boolean;
  /** 是否显示斑马纹 */
  stripedRows?: boolean;
  /** 是否显示边框 */
  showGridlines?: boolean;
  /** 空消息 */
  emptyMessage?: string;
  /** 表格样式 */
  tableStyle?: string | Record<string, any>;
  /** 表格类名 */
  tableClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  value: () => [],
  columns: () => [],
  dataKey: 'id',
  loading: false,
  stripedRows: true,
  showGridlines: false,
  emptyMessage: '没有可用数据',
});

/** 排序状态 */
const sortField = ref<string | null>(null);
const sortOrder = ref<1 | -1>(1);

/** 处理排序 */
function handleSort(field: string | undefined) {
  if (!field) return;

  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 1 ? -1 : 1;
  } else {
    sortField.value = field;
    sortOrder.value = 1;
  }
}

/** 排序后的数据 */
const sortedData = computed(() => {
  if (!sortField.value) return props.value;

  return [...props.value].sort((a, b) => {
    const aVal = a[sortField.value!];
    const bVal = b[sortField.value!];

    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (aVal < bVal) return sortOrder.value === 1 ? -1 : 1;
    return sortOrder.value === 1 ? 1 : -1;
  });
});

/** 获取单元格值 */
function getCellValue(row: any, column: Column) {
  if (column.field) {
    return row[column.field];
  }
  return null;
}

/** 表格样式类 */
const tableClasses = computed(() => {
  const classes = ['w-full', 'border-collapse'];
  if (props.tableClass) {
    classes.push(props.tableClass);
  }
  return classes.join(' ');
});

/** 行样式类 */
const rowClasses = computed(() => {
  const classes = ['border-b', 'border-gray-200', 'dark:border-gray-700'];
  if (props.stripedRows) {
    classes.push('even:bg-gray-50', 'dark:even:bg-gray-800/50');
  }
  return classes.join(' ');
});

/** 单元格样式类 */
const cellClasses = (column: Column) => {
  const classes = ['px-4', 'py-3', 'text-sm'];

  if (column.align === 'center') {
    classes.push('text-center');
  } else if (column.align === 'right') {
    classes.push('text-right');
  } else {
    classes.push('text-left');
  }

  return classes.join(' ');
};

/** 排序图标 */
const sortIcon = (field: string | undefined) => {
  if (sortField.value !== field) return null;
  return sortOrder.value === 1 ? '↑' : '↓';
};
</script>

<template>
  <div class="overflow-x-auto">
    <table :class="tableClasses" :style="tableStyle">
      <thead class="bg-gray-50 dark:bg-gray-800">
        <tr>
          <th
            v-for="(column, index) in columns"
            :key="index"
            :class="[
              'px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
              { 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700': column.sortable }
            ]"
            :style="column.style"
            @click="column.sortable ? handleSort(column.field) : null">
            <div class="flex items-center gap-2">
              {{ column.header }}
              <span v-if="column.sortable" class="text-gray-400">
                {{ sortIcon(column.field) }}
              </span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-900">
        <tr v-if="loading">
          <td :colspan="columns.length" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            加载中...
          </td>
        </tr>
        <tr v-else-if="sortedData.length === 0">
          <td :colspan="columns.length" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            {{ emptyMessage }}
          </td>
        </tr>
        <tr
          v-else
          v-for="(row, rowIndex) in sortedData"
          :key="row[dataKey] || rowIndex"
          :class="rowClasses">
          <td
            v-for="(column, colIndex) in columns"
            :key="colIndex"
            :class="cellClasses(column)">
            <slot :name="`body-${column.field}`" :row="row" :index="rowIndex">
              <slot name="body" :row="row" :column="column" :index="rowIndex">
                {{ getCellValue(row, column) }}
              </slot>
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
