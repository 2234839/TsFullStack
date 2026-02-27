/**
 * Popover 组件类型定义
 * 基于 reka-ui 的 Popover 组件封装
 */
import type { PopoverRootEmits, PopoverRootProps } from 'reka-ui';

/** Popover 显示位置 */
export type PopoverSide = 'top' | 'right' | 'bottom' | 'left';

/** Popover 对齐方式 */
export type PopoverAlign = 'start' | 'center' | 'end';

/** Popover 触发方式 */
export type PopoverTrigger = 'click' | 'hover';

/**
 * Popover 组件 Props
 */
export interface UiPopoverProps extends Omit<PopoverRootProps, 'open'> {
  /** Popover 内容 */
  content?: string;
  /** 显示位置 */
  side?: PopoverSide;
  /** 对齐方式 */
  align?: PopoverAlign;
  /** 偏移距离 */
  sideOffset?: number;
  /** 触发方式 */
  trigger?: PopoverTrigger;
  /** 是否显示关闭图标 */
  showCloseIcon?: boolean;
  /** 点击外部是否关闭 */
  closeOnClickOutside?: boolean;
  /** 默认是否打开 */
  defaultOpen?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 延迟打开时间（hover 模式） */
  delayDuration?: number;
}

/**
 * Popover 组件 Emits
 */
export interface UiPopoverEmits extends Omit<PopoverRootEmits, 'update:open'> {
  /** Popover 打开事件 */
  open: [];
}
