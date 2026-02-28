/**
 * Drawer 组件类型定义
 * 基于 reka-ui 的 Dialog 组件封装
 */

/**
 * Drawer 显示位置
 */
export type DrawerSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * Drawer 组件 Props
 */
export interface UiDrawerProps {
  /** 是否打开 */
  open?: boolean;
  /** 显示位置 */
  side?: DrawerSide;
  /** 抽屉宽度（side 为 left/right 时） */
  width?: string;
  /** 抽屉高度（side 为 top/bottom 时） */
  height?: string;
  /** 是否显示关闭按钮 */
  showClose?: boolean;
  /** 点击遮罩是否关闭 */
  closeOnClickOutside?: boolean;
  /** 标题 */
  title?: string;
}

/**
 * Drawer 组件 Emits
 */
export interface UiDrawerEmits {
  /** 更新打开状态 */
  'update:open': [value: boolean];
  /** 关闭事件 */
  close: [];
}

/**
 * Drawer 组件实例
 */
export interface UiDrawerInstance {
  /** 打开抽屉 */
  open: () => void;
  /** 关闭抽屉 */
  close: () => void;
}
