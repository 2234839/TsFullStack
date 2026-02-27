/**
 * Dialog 组件类型定义
 * 基于 reka-ui 的 Dialog 组件封装
 */
import type { DialogRootEmits, DialogRootProps } from 'reka-ui';

/**
 * Dialog 组件 Props
 */
export interface UiDialogProps extends Omit<DialogRootProps, 'open'> {
  /** Dialog 标题 */
  title?: string;
  /** Dialog 描述 */
  description?: string;
  /** 默认是否打开 */
  defaultOpen?: boolean;
  /** 是否模态对话框 */
  modal?: boolean;
}

/**
 * Dialog 组件 Emits
 */
export interface UiDialogEmits extends Omit<DialogRootEmits, 'update:open'> {}

/**
 * Dialog 组件实例
 */
export interface UiDialogInstance {
  /** 打开 Dialog */
  open: () => void;
  /** 关闭 Dialog */
  close: () => void;
}
