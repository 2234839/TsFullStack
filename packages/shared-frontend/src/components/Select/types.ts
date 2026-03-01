/**
 * Select 组件类型定义
 * 基于 reka-ui 的 Select 组件封装
 */
import type { SelectRootEmits, SelectRootProps } from 'reka-ui';

/** Select 显示位置 */
export type SelectSide = 'top' | 'right' | 'bottom' | 'left';

/** Select 对齐方式 */
export type SelectAlign = 'start' | 'center' | 'end';

/**
 * Select 选项数据类型
 */
export interface SelectOption {
  /** 选项值 */
  value: string;
  /** 显示文本 */
  label: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * Select 组件 Props
 */
export interface UiSelectProps extends Omit<SelectRootProps, 'modelValue'> {
  /** 选项列表 */
  options: SelectOption[];
  /** 占位文本 */
  placeholder?: string;
  /** 显示位置 */
  side?: SelectSide;
  /** 对齐方式 */
  align?: SelectAlign;
  /** 偏移距离 */
  sideOffset?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 选项值（支持 null 作为未选择状态） */
  modelValue?: string | null;
}

/**
 * Select 组件 Emits
 */
export interface UiSelectEmits extends SelectRootEmits {
  /** 更新选中值（支持 null 作为未选择状态） */
  'update:modelValue': [value: string | null];
}
