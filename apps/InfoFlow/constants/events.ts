// 事件类型常量
export const EVENT_TYPES = {
  RULE_EXECUTION_COMPLETED: 'RULE_EXECUTION_COMPLETED',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];