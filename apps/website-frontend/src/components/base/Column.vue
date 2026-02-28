<script setup lang="ts">
/**
 * 数据表格列组件
 * 用于 DataTable 的列定义
 */
interface Props {
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

defineProps<Props>();
</script>

<template>
  <!-- 此组件不渲染任何内容，仅用于定义 -->
</template>
