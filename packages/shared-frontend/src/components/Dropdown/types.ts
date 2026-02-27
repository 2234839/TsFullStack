/**
 * Dropdown 组件类型定义
 * 基于 reka-ui 的 DropdownMenu 组件封装
 */
import type { DropdownMenuRootEmits, DropdownMenuRootProps } from 'reka-ui';

/** Dropdown 显示位置 */
export type DropdownSide = 'top' | 'right' | 'bottom' | 'left';

/** Dropdown 对齐方式 */
export type DropdownAlign = 'start' | 'center' | 'end';

/**
 * Dropdown 组件 Props
 */
export interface UiDropdownProps extends Omit<DropdownMenuRootProps, 'open'> {
  /** 显示位置 */
  side?: DropdownSide;
  /** 对齐方式 */
  align?: DropdownAlign;
  /** 偏移距离 */
  sideOffset?: number;
  /** 是否显示关闭图标 */
  showCloseIcon?: boolean;
  /** 点击外部是否关闭 */
  closeOnClickOutside?: boolean;
  /** 默认是否打开 */
  defaultOpen?: boolean;
  /** 是否打开（受控模式） */
  open?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * Dropdown 组件 Emits
 */
export interface UiDropdownEmits extends DropdownMenuRootEmits {
  /** 更新打开状态 */
  'update:modelValue': [value: boolean];
  /** Dropdown 打开事件 */
  open: [];
}

/**
 * Dropdown 组件实例
 */
export interface UiDropdownInstance {
  /** 打开 Dropdown */
  open: () => void;
  /** 关闭 Dropdown */
  close: () => void;
  /** 切换 Dropdown 状态 */
  toggle: () => void;
}
