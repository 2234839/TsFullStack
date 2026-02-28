/**
 * ContextMenu 组件类型定义
 * 基于 reka-ui 的 ContextMenu 组件封装
 */

/**
 * 菜单项接口
 */
export interface MenuItem {
  /** 菜单项标签 */
  label: string;
  /** 图标类名 */
  icon?: string;
  /** 点击命令 */
  command?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * ContextMenu 组件 Props
 */
export interface UiContextMenuProps {
  /** 菜单项列表 */
  model: MenuItem[];
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * ContextMenu 组件实例
 */
export interface UiContextMenuInstance {
  /** 打开上下文菜单 */
  show: (event: MouseEvent) => void;
  /** 关闭上下文菜单 */
  hide: () => void;
}
