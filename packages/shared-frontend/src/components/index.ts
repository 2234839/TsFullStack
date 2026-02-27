// ABOUTME: 共享组件导出
// 这里可以放置需要在多个模块间共享的基础组件
export { Tooltip } from './Tooltip';
export type {
  TooltipAlign,
  TooltipSide,
  UiTooltipEmits,
  UiTooltipInstance,
  UiTooltipProps,
} from './Tooltip';

export { Popover } from './Popover';
export type {
  PopoverAlign,
  PopoverSide,
  PopoverTrigger,
  UiPopoverEmits,
  UiPopoverProps,
} from './Popover';

export { Dropdown } from './Dropdown';
export type {
  DropdownAlign,
  DropdownSide,
  UiDropdownEmits,
  UiDropdownInstance,
  UiDropdownProps,
} from './Dropdown';

export { Dialog } from './Dialog';
export type {
  UiDialogEmits,
  UiDialogInstance,
  UiDialogProps,
} from './Dialog';