/**
 * 全局 Toast composable
 * 提供通知功能
 */
import { ref } from 'vue';

interface ToastMessage {
  id: number;
  severity?: 'success' | 'error' | 'info' | 'warn';
  summary: string;
  detail?: string;
  life?: number;
}

const messages = ref<ToastMessage[]>([]);
let messageIdCounter = 0;

/** 添加消息 */
function add(message: Omit<ToastMessage, 'id'>) {
  const id = messageIdCounter++;
  const messageWithId: ToastMessage = { id, ...message };

  messages.value.push(messageWithId);

  // 自动移除
  if (message.life) {
    setTimeout(() => {
      remove(id);
    }, message.life);
  }

  return id;
}

/** 移除消息 */
function remove(id: number) {
  const index = messages.value.findIndex(m => m.id === id);
  if (index !== -1) {
    messages.value.splice(index, 1);
  }
}

/** 成功消息 */
function success(summary: string, detail?: string, life = 3000) {
  return add({ severity: 'success', summary, detail, life });
}

/** 错误消息 */
function error(summary: string, detail?: string, life = 5000) {
  return add({ severity: 'error', summary, detail, life });
}

/** 信息消息 */
function info(summary: string, detail?: string, life = 3000) {
  return add({ severity: 'info', summary, detail, life });
}

/** 警告消息 */
function warn(summary: string, detail?: string, life = 4000) {
  return add({ severity: 'warn', summary, detail, life });
}

/** 清除所有消息 */
function removeAll() {
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
