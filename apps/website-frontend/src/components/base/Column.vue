<script setup lang="ts">
/**
 * 数据表格列组件
 * 用于 DataTable 的列定义
 * 兼容 PrimeVue Column API
 */
interface Props {
  /** 字段名 */
  field?: string;
  /** 列头 */
  header?: string;
  /** 是否可排序 */
  sortable?: boolean;
  /** 列宽 */
  style?: string | Record<string, any>;
  /** body 样式 */
  bodyStyle?: string | Record<string, any>;
  /** 列对齐 */
  align?: 'left' | 'center' | 'right';
  /** 选择模式 */
  selectionMode?: 'single' | 'multiple';
  /** 排序字段 */
  sortField?: string;
  /** 排序顺序 */
  sortOrder?: 1 | -1;
}

defineProps<Props>();
</script>

<template>
  <!-- 此组件不渲染任何内容，仅用于定义 -->
</template>
