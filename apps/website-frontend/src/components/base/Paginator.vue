<script setup lang="ts">
/**
 * 分页器组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 总条数 */
  rows?: number;
  /** 每页条数 */
  rowsPerPage?: number;
  /** 当前页码（从0开始） */
  page?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示每页条数选择器 */
  showRowsPerPageOptions?: boolean;
  /** 每页条数选项 */
  rowsPerPageOptions?: number[];
}

const props = withDefaults(defineProps<Props>(), {
  rows: 0,
  rowsPerPage: 10,
  page: 0,
  disabled: false,
  showRowsPerPageOptions: false,
  rowsPerPageOptions: () => [10, 20, 50, 100],
});

const emit = defineEmits<{
  'update:page': [page: number];
  'update:rowsPerPage': [rowsPerPage: number];
}>();

/** 总页数 */
const totalPages = computed(() => Math.ceil(props.rows / props.rowsPerPage));

/** 当前页码（从1开始显示） */
const currentPage = computed({
  get: () => props.page + 1,
  set: (value) => emit('update:page', value - 1),
});

/** 起始记录索引 */
const firstRecord = computed(() => props.page * props.rowsPerPage + 1);

/** 结束记录索引 */
const lastRecord = computed(() =>
  Math.min((props.page + 1) * props.rowsPerPage, props.rows)
);

/** 页码列表 */
const pageNumbers = computed(() => {
  const pages: (number | string)[] = [];
  const maxButtons = 5;

  if (totalPages.value <= maxButtons) {
    for (let i = 1; i <= totalPages.value; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);

    let start = Math.max(2, currentPage.value - 1);
    let end = Math.min(totalPages.value - 1, currentPage.value + 1);

    if (currentPage.value <= 3) {
      start = 2;
      end = 4;
    } else if (currentPage.value >= totalPages.value - 2) {
      start = totalPages.value - 3;
      end = totalPages.value - 1;
    }

    if (start > 2) pages.push('...');

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages.value - 1) pages.push('...');

    pages.push(totalPages.value);
  }

  return pages;
});

/** 跳转到指定页 */
function goToPage(page: number | string) {
  if (typeof page === 'number') {
    currentPage.value = page;
  }
}

/** 上一页 */
function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

/** 下一页 */
function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
}

/** 按钮样式类 */
const buttonClasses = (active: boolean, disabled: boolean) => {
  const base = 'min-w-8 px-2 py-1 text-sm border rounded transition-colors duration-200';
  const activeClass = active
    ? 'bg-primary-600 text-white border-primary-600 dark:bg-primary-500 dark:border-primary-500'
    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${base} ${activeClass} ${disabledClass}`;
};

/**
 * 处理每页条数变化
 */
function handleRowsPerPageChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const newValue = parseInt(target.value, 10);
  emit('update:rowsPerPage', newValue);
  /** 切换每页条数后重置到第一页 */
  emit('update:page', 0);
}
</script>

<template>
  <div class="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg">
    <!-- 信息显示和每页条数选择器 -->
    <div class="flex items-center gap-4 text-sm text-gray-700 dark:text-gray-300">
      <div>
        显示 {{ firstRecord }}-{{ lastRecord }} 条，共 {{ rows }} 条
      </div>

      <!-- 每页条数选择器 -->
      <div v-if="showRowsPerPageOptions" class="flex items-center gap-2">
        <select
          :disabled="disabled"
          :value="rowsPerPage"
          @change="handleRowsPerPageChange"
          class="px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <option v-for="option in rowsPerPageOptions" :key="option" :value="option">
            {{ option }} 条/页
          </option>
        </select>
      </div>
    </div>

    <!-- 分页按钮 -->
    <div class="flex items-center gap-2">
      <!-- 上一页 -->
      <button :disabled="disabled || currentPage <= 1" :class="buttonClasses(false, disabled || currentPage <= 1)"
        @click="prevPage">
        上一页
      </button>

      <!-- 页码 -->
      <button v-for="(page, index) in pageNumbers" :key="index" :disabled="disabled || page === '...'"
        :class="buttonClasses(page === currentPage, disabled || page === '...')" @click="goToPage(page)">
        {{ page }}
      </button>

      <!-- 下一页 -->
      <button :disabled="disabled || currentPage >= totalPages"
        :class="buttonClasses(false, disabled || currentPage >= totalPages)" @click="nextPage">
        下一页
      </button>
    </div>
  </div>
</template>
