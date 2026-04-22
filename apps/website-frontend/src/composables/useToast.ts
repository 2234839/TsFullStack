/**
 * 全局 Toast composable
 * 提供通知功能
 */
import { ref } from 'vue';

interface ToastMessage {
  id: number;
  /** Toast 变体：success/error/info/warn/warning/danger */
  variant?: 'success' | 'error' | 'info' | 'warn' | 'warning' | 'danger';
  summary: string;
  detail?: string;
  life?: number;
}

const messages = ref<ToastMessage[]>([]);
let messageIdCounter = 0;
/** 追踪活跃的自动移除定时器，支持手动移除时取消定时器 */
const autoRemoveTimers = new Map<number, ReturnType<typeof setTimeout>>();

/** 添加消息 */
function add(message: Omit<ToastMessage, 'id'>) {
  const id = messageIdCounter++;
  const messageWithId: ToastMessage = { id, ...message };

  messages.value.push(messageWithId);

  // 自动移除（使用追踪 Map 支持提前移除时清理）
  if (message.life) {
    const timer = setTimeout(() => {
      autoRemoveTimers.delete(id);
      remove(id);
    }, message.life);
    autoRemoveTimers.set(id, timer);
  }

  return id;
}

/** 移除消息（同时清理自动移除定时器） */
function remove(id: number) {
  const timer = autoRemoveTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    autoRemoveTimers.delete(id);
  }
  const index = messages.value.findIndex(m => m.id === id);
  if (index !== -1) {
    messages.value.splice(index, 1);
  }
}

/** 成功消息 */
function success(summary: string, detail?: string, life = 3000) {
  return add({ variant: 'success', summary, detail, life });
}

/** 错误消息 */
function error(summary: string, detail?: string, life = 5000) {
  return add({ variant: 'error', summary, detail, life });
}

/** 信息消息 */
function info(summary: string, detail?: string, life = 3000) {
  return add({ variant: 'info', summary, detail, life });
}

/** 警告消息 */
function warn(summary: string, detail?: string, life = 4000) {
  return add({ variant: 'warn', summary, detail, life });
}

/** 清除所有消息（同时清理自动移除定时器） */
function removeAll() {
  for (const timer of autoRemoveTimers.values()) {
    clearTimeout(timer);
  }
  autoRemoveTimers.clear();
  messages.value = [];
}

/**
 * Toast composable
 * 提供全局的 Toast 功能
 */
export function useToast() {
  return {
    add,
    remove,
    success,
    error,
    info,
    warn,
    removeAll,
  };
}

/** 导出 messages 供 Toast 组件使用 */
export function useToastMessages() {
  return { messages };
}
