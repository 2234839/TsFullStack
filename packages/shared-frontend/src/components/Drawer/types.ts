/**
 * Drawer 组件类型定义
 * 基于 reka-ui 的 Drawer primitives 封装
 */

/**
 * Drawer 显示位置
 */
export type DrawerSide = "left" | "right" | "top" | "bottom";

/**
 * Drawer 组件 Props
 */
export interface UiDrawerProps {
  /** 显示位置 */
  side?: DrawerSide;
  /** 抽屉宽度（side 为 left/right 时） */
  width?: string;
  /** 是否显示关闭按钮 */
  showClose?: boolean;
  /** 标题 */
  title?: string;
}

/**
 * Drawer 组件实例（reka 原生管理 open 状态，无需暴露方法）
 */
export interface UiDrawerInstance {
  /** 打开抽屉（通过 v-model:open 控制） */
  open: boolean;
}

/**
 * Drawer 组件事件定义
 */
export interface UiDrawerEmits {
  /** 开关状态变化（v-model:open） */
  (e: "update:open", value: boolean): void;
}
