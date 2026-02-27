/**
 * Tooltip 组件类型定义
 * 基于 reka-ui 的 Tooltip 组件封装
 */
import type { TooltipRootProps, TooltipRootEmits } from 'reka-ui';

/** Tooltip 显示位置 */
export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

/** Tooltip 对齐方式 */
export type TooltipAlign = 'start' | 'center' | 'end';

/** Tooltip 组件属性接口 */
export interface UiTooltipProps extends Omit<TooltipRootProps, 'delayDuration' | 'closeOnClick'> {
  /** 显示的提示内容 */
  content?: string;
  /** 显示位置 */
  side?: TooltipSide;
  /** 对齐方式 */
  align?: TooltipAlign;
  /** 与触发元素的偏移距离 */
  sideOffset?: number;
  /** 延迟显示时间（毫秒） */
  delayDuration?: number;
  /** 跳过延迟显示的时间（毫秒） */
  skipDelayDuration?: number;
}

/** Tooltip 组件事件接口 */
export interface UiTooltipEmits extends Omit<TooltipRootEmits, 'closeOnClick'> {}

/** Tooltip 组件实例类型 */
export interface UiTooltipInstance {
  /** 设置提示内容 */
  setContent: (content: string) => void;
  /** 打开提示 */
  open: () => void;
  /** 关闭提示 */
  close: () => void;
}
